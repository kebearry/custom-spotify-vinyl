import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function POST(request: Request) {
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
    const { trackUri, playlistUri, position_ms = 0 } = await request.json();

    // First ensure playback is stopped
    await spotifyApi.pause();
    
    // Then start playing the specific track
    await spotifyApi.play({
      context_uri: playlistUri,
      offset: { uri: trackUri },
      position_ms
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error playing track:', error);
    return NextResponse.json({ error: 'Failed to play track' }, { status: 500 });
  }
} 