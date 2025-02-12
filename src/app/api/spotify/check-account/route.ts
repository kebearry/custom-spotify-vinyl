import { NextResponse } from 'next/server';
import { getAccessToken } from '../../../lib/spotify/auth/get-access-token';

export async function GET() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch account details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      isPremium: data.product === 'premium',
      product: data.product
    });
    
  } catch (error) {
    console.error('Error in check-account route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 