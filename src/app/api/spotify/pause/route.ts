import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function PUT() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  spotifyApi.setAccessToken(accessToken);

  try {
    const result = await spotifyApi.pause();
    
    // Check if the result exists and has a status code
    if (result && result.statusCode >= 200 && result.statusCode < 300) {
      return NextResponse.json({ 
        success: true,
        message: 'Playback paused successfully'
      });
    } else {
      throw new Error('Unexpected response from Spotify API');
    }
  } catch (error: unknown) {
    console.error('Error pausing playback:', error);
    
    if (error && typeof error === 'object' && 'body' in error) {
      const spotifyError = error as { body: { error: { message: string; status: number } } };
      return NextResponse.json({ 
        error: spotifyError.body.error.message || 'Failed to pause playback',
        code: spotifyError.body.error.status || 500
      }, { 
        status: spotifyError.body.error.status || 500 
      });
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to pause playback',
      code: 500
    }, { 
      status: 500 
    });
  }
} 