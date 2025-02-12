import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    console.log('Access Token Present:', !!accessToken); // Debug log

    if (!accessToken) {
      console.log('No access token found in cookies'); // Debug log
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    spotifyApi.setAccessToken(accessToken);

    const data = await spotifyApi.getMyCurrentPlaybackState();
    
    if (data.body && data.body.item) {
      return NextResponse.json({
        track: data.body.item,
        isPlaying: data.body.is_playing,
        device: data.body.device,
        progress_ms: data.body.progress_ms,
        timestamp: Date.now()
      });
    }

    return NextResponse.json({
      track: null,
      isPlaying: false,
      device: null,
      progress_ms: 0,
      timestamp: Date.now()
    });
  } catch (error: unknown) {
    console.error('Error getting current track:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const spotifyError = error as { 
        statusCode: number;
        body?: { 
          error?: { 
            message: string; 
            status: number;
          } 
        } 
      };

      // Check if it's an authentication error
      if (spotifyError.statusCode === 401 || spotifyError.body?.error?.status === 401) {
        console.log('Spotify API returned 401 - Token might be expired or invalid'); // Debug log
        return NextResponse.json({ 
          error: 'Authentication expired', 
          message: spotifyError.body?.error?.message || 'Token expired or invalid'
        }, { 
          status: 401 
        });
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to get current track',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
} 