import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function GET() {
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
  } catch (error) {
    console.error('Error getting current track:', error);
    return NextResponse.json({ error: 'Failed to get current track' }, { status: 500 });
  }
} 