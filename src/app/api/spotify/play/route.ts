import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function PUT(request: Request) {
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
    const { deviceId, trackUri, contextUri, position_ms } = await request.json();

    if (!trackUri) {
      return NextResponse.json({ error: 'No track URI provided' }, { status: 400 });
    }

    interface PlayOptions {
      device_id: string;
      position_ms?: number;
      context_uri?: string;
      offset?: { uri: string };
      uris?: string[];
    }

    const playOptions: PlayOptions = {
      device_id: deviceId,
      position_ms: position_ms || 0
    };

    if (contextUri) {
      // If we have a playlist context
      playOptions.context_uri = contextUri;
      playOptions.offset = { uri: trackUri };
    } else {
      // If we're just playing a single track
      playOptions.uris = [trackUri];
    }

    console.log('Play options:', playOptions); // Debug log

    const result = await spotifyApi.play(playOptions);
    
    // Check if the result exists and has a status code
    if (result && result.statusCode >= 200 && result.statusCode < 300) {
      return NextResponse.json({ 
        success: true,
        message: 'Playback started successfully'
      });
    } else {
      throw new Error('Unexpected response from Spotify API');
    }
  } catch (error: unknown) {
    console.error('Error starting playback:', error);
    
    if (error && typeof error === 'object' && 'body' in error) {
      const spotifyError = error as { body: { error: { message: string; status: number } } };
      return NextResponse.json({ 
        error: spotifyError.body.error.message || 'Failed to start playback',
        code: spotifyError.body.error.status || 500
      }, { 
        status: spotifyError.body.error.status || 500 
      });
    }

    // Generic error handling
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to start playback',
      code: 500
    }, { 
      status: 500 
    });
  }
} 