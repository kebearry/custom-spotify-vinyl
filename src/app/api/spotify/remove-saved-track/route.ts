import SpotifyWebApi from 'spotify-web-api-node';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token found' },
        { status: 401 }
      );
    }

    const spotifyApi = new SpotifyWebApi({
      accessToken: accessToken
    });

    const { trackId } = await request.json();
    await spotifyApi.removeFromMySavedTracks([trackId]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing track:', error);
    return NextResponse.json(
      { error: 'Failed to remove track' },
      { status: 500 }
    );
  }
} 