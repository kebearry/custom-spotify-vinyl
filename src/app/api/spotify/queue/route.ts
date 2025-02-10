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
    // Get current playback state for previous track
    const playbackState = await spotifyApi.getMyCurrentPlaybackState();
    
    // Get queue using raw endpoint
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const queue = await queueResponse.json();

    return NextResponse.json({
      previous: playbackState.body?.item,
      next: queue.queue?.[0] || null,
    });
  } catch (error) {
    console.error('Error getting queue:', error);
    return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 });
  }
} 