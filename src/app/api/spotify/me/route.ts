import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import SpotifyWebApi from 'spotify-web-api-node';

export async function GET() {
  try {
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

    const me = await spotifyApi.getMe();
    
    return NextResponse.json({
      isPremium: me.body.product === 'premium',
      user: {
        id: me.body.id,
        name: me.body.display_name,
        email: me.body.email,
        product: me.body.product
      }
    });

  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch user info',
      isPremium: false 
    }, { status: 500 });
  }
} 