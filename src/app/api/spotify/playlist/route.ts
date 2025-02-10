import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

const PLAYLIST_ID = '1odn9BcsovHl9YoaOb38t6?si=d7f02dbf34ba4e7c'; // Replace with your playlist ID

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
    const playlist = await spotifyApi.getPlaylist(PLAYLIST_ID);
    return NextResponse.json({ 
      playlist: {
        id: playlist.body.id,
        name: playlist.body.name,
        description: playlist.body.description,
        tracks: playlist.body.tracks.items.map(item => item.track),
        images: playlist.body.images
      }
    });
  } catch (error) {
    console.error('Error getting playlist:', error);
    return NextResponse.json({ error: 'Failed to get playlist' }, { status: 500 });
  }
}

export async function POST() {
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
    // Start playing the playlist with repeat mode off
    await spotifyApi.play({
      context_uri: `spotify:playlist:${PLAYLIST_ID}`,
    });
    
    // Set repeat mode to off
    await spotifyApi.setRepeat('off');
    
    // Set shuffle to off
    await spotifyApi.setShuffle(false);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error playing playlist:', error);
    return NextResponse.json({ error: 'Failed to play playlist' }, { status: 500 });
  }
} 