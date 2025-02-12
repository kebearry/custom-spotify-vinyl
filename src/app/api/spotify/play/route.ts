import { NextResponse } from 'next/server';
import { getAccessToken } from '../../../lib/spotify/auth/get-access-token';

export async function PUT(request: Request) {
  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, contextUri, offset, position_ms } = body;

    // Base URL for the play endpoint
    let url = 'https://api.spotify.com/v1/me/player/play';
    
    // Add device_id as query parameter if provided
    if (deviceId) {
      url += `?device_id=${deviceId}`;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_uri: contextUri,
        offset: offset,
        position_ms: position_ms
      }),
    });

    // If the response is 204 (success with no content) or 200
    if (response.status === 204 || response.status === 200) {
      return NextResponse.json({ success: true });
    }

    // If there's an error, get the error details
    const errorData = await response.json();
    console.error('Spotify play error:', errorData);

    return NextResponse.json(
      { 
        error: errorData.error?.message || 'Failed to start playback',
        details: errorData
      }, 
      { status: response.status }
    );

  } catch (error) {
    console.error('Error in play route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 