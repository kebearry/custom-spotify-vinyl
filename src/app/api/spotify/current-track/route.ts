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
    const playbackState = await spotifyApi.getMyCurrentPlaybackState();
    console.log('Playback state:', playbackState.body);

    if (!playbackState.body || !playbackState.body.device) {
      return NextResponse.json({ 
        error: 'No active Spotify session found',
        isPlaying: false,
        track: null
      });
    }

    // Get the current context (playlist, album, etc.)
    const context = playbackState.body.context;
    let previousTrack = null;
    let nextTrack = null;

    if (context && context.type === 'playlist') {
      // Get the current playlist tracks
      const playlist = await spotifyApi.getPlaylist(context.uri.split(':')[2]);
      const tracks = playlist.body.tracks.items;
      const currentIndex = tracks.findIndex(item => 
        item.track?.id === playbackState.body.item?.id
      );

      if (currentIndex > 0) {
        previousTrack = tracks[currentIndex - 1].track;
      }
      if (currentIndex < tracks.length - 1) {
        nextTrack = tracks[currentIndex + 1].track;
      }
    }

    return NextResponse.json({ 
      track: playbackState.body.item,
      isPlaying: playbackState.body.is_playing,
      device: {
        id: playbackState.body.device.id,
        name: playbackState.body.device.name,
        type: playbackState.body.device.type
      },
      previousTrack,
      nextTrack,
      context: context ? {
        type: context.type,
        uri: context.uri
      } : null
    });
  } catch (error) {
    console.error('Error getting current track:', error);
    return NextResponse.json({ error: 'Failed to get current track' }, { status: 500 });
  }
} 