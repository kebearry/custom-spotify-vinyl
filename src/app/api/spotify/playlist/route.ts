import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID || undefined;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('id');

    if (!playlistId) {
      return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
    }

    console.log('Fetching playlist:', playlistId);

    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    spotifyApi.setAccessToken(accessToken);

    try {
      // First try to get the playlist metadata
      const metaData = await spotifyApi.getPlaylist(playlistId, { 
        fields: 'id,name,public'
      });
      
      console.log('Playlist metadata:', {
        id: metaData.body.id,
        name: metaData.body.name,
        public: metaData.body.public
      });

      // If we can get metadata, we should be able to get the full playlist
      const data = await spotifyApi.getPlaylist(playlistId);
      return NextResponse.json(data.body);
    } catch (spotifyError: unknown) {
      interface SpotifyError {
        statusCode: number;
        message: string;
        body: {
          error?: {
            status: number;
            message: string;
          }
        }
      }
      
      const error = spotifyError as SpotifyError;
      console.error('Spotify API error:', {
        status: error.statusCode,
        message: error.message,
        body: error.body
      });

      if (error.statusCode === 403) {
        // Try one more time with minimal fields
        try {
          const publicData = await spotifyApi.getPlaylist(playlistId, { 
            fields: 'id,name,tracks.items(track(id,name,artists,album))'
          });
          console.log('Successfully fetched public data');
          return NextResponse.json(publicData.body);
        } catch (publicError: unknown) {
          const error = publicError as SpotifyError;
          console.error('Failed to fetch public data:', error);
          return NextResponse.json({
            error: 'Unable to access playlist',
            details: {
              message: error.message,
              statusCode: error.statusCode,
              isPublic: true
            }
          }, { status: 403 });
        }
      }

      return NextResponse.json({
        error: 'Failed to fetch playlist',
        details: {
          message: error.message,
          statusCode: error.statusCode
        }
      }, { status: error.statusCode || 500 });
    }
  } catch (error) {
    console.error('General error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
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