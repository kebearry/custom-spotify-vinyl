import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';
import { PLAYLIST_URI } from '@/app/lib/spotify';

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
    const { play } = await request.json();
    
    if (play) {
      // When starting playback, always play from your playlist
      await spotifyApi.play({
        context_uri: PLAYLIST_URI,
      });
    } else {
      await spotifyApi.pause();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling playback:', error);
    return NextResponse.json({ error: 'Failed to toggle playback' }, { status: 500 });
  }
} 