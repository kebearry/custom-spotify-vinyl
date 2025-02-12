import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID || undefined;
let lastApiCall = 0;
const MIN_API_INTERVAL = 1000; // 1 second minimum between calls

export async function GET() {
  try {
    if (!PLAYLIST_ID) {
      return NextResponse.json({ 
        error: 'Playlist ID not configured' 
      }, { status: 500 });
    }

    const now = Date.now();
    if (now - lastApiCall < MIN_API_INTERVAL) {
      return NextResponse.json({ 
        error: 'Too many requests, please wait' 
      }, { status: 429 });
    }
    lastApiCall = now;

    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get('spotify_access_token');
    const accessToken = accessTokenCookie?.value || undefined;

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? undefined,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? undefined,
    });

    spotifyApi.setAccessToken(accessToken);

    const playlist = await spotifyApi.getPlaylist(PLAYLIST_ID);
    
    if (!playlist?.body) {
      throw new Error('Invalid playlist response');
    }

    return NextResponse.json({ 
      playlist: {
        id: playlist.body.id,
        name: playlist.body.name,
        description: playlist.body.description,
        tracks: playlist.body.tracks.items.map(item => item.track),
        images: playlist.body.images
      }
    });
  } catch (error: unknown) {
    console.error('Error getting playlist:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      if (error.statusCode === 429) {
        return NextResponse.json({ 
          error: 'Rate limit exceeded, please wait' 
        }, { status: 429 });
      }
      return NextResponse.json({ 
        error: 'Failed to get playlist' 
      }, { status: (error.statusCode as number) || 500 });
    }

    return NextResponse.json({ 
      error: 'Failed to get playlist' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { play } = await request.json();
    
    if (!PLAYLIST_ID) {
      return NextResponse.json({ 
        error: 'Playlist ID not configured' 
      }, { status: 500 });
    }

    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get('spotify_access_token');
    const accessToken = accessTokenCookie?.value || undefined;

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? undefined,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? undefined,
    });

    spotifyApi.setAccessToken(accessToken);

    // Get all devices and find an available one
    const devices = await spotifyApi.getMyDevices();
    const activeDevice = devices.body.devices.find(device => device.is_active && device.id);
    
    if (!activeDevice?.id) {
      return NextResponse.json({ 
        error: 'No valid Spotify device found. Please open Spotify on any device.' 
      }, { status: 400 });
    }

    try {
      if (play) {
        // Start playing
        await spotifyApi.play({
          device_id: activeDevice.id,
          context_uri: `spotify:playlist:${PLAYLIST_ID}`,
        });
        await spotifyApi.setRepeat('off', { device_id: activeDevice.id });
        await spotifyApi.setShuffle(false, { device_id: activeDevice.id });
      } else {
        // Pause playback
        await spotifyApi.pause({ device_id: activeDevice.id });
      }

      // Get updated playback state
      const playbackState = await spotifyApi.getMyCurrentPlaybackState();
      
      return NextResponse.json({ 
        success: true,
        device: activeDevice,
        is_playing: playbackState.body?.is_playing ?? false
      });
    } catch (playError: unknown) {
      console.error('Playback error:', playError);
      // If we get a "No active device" error, try to transfer playback again
      if (
        typeof playError === 'object' && 
        playError && 
        'message' in playError && 
        typeof playError.message === 'string' && 
        playError.message.includes('NO_ACTIVE_DEVICE')
      ) {
        await spotifyApi.transferMyPlayback([activeDevice.id]);
        return NextResponse.json({ 
          error: 'Please try again - activating Spotify device' 
        }, { status: 503 });
      }
      throw playError;
    }
  } catch (error) {
    console.error('Error controlling playback:', error);
    return NextResponse.json({ 
      error: 'Failed to control playback' 
    }, { status: 500 });
  }
} 