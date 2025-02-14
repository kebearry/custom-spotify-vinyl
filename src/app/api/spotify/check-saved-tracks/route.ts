import SpotifyWebApi from 'spotify-web-api-node';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
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

    // Get trackIds from URL
    const { searchParams } = new URL(request.url);
    const trackIds = searchParams.get('ids')?.split(',');

    if (!trackIds) {
      return NextResponse.json(
        { error: 'No track IDs provided' },
        { status: 400 }
      );
    }

    const response = await spotifyApi.containsMySavedTracks(trackIds);
    return NextResponse.json(response.body);
  } catch (error) {
    console.error('Error checking saved tracks:', error);
    return NextResponse.json(
      { error: 'Failed to check saved tracks' },
      { status: 500 }
    );
  }
} 