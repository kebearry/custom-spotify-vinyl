import { NextResponse } from 'next/server';
import SpotifyWebApi from 'spotify-web-api-node';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }
  
  try {
    // Create a new instance with all credentials for server-side operations
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
    });

    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    console.log('Successfully obtained tokens:', {
      accessTokenLength: access_token.length,
      hasRefreshToken: !!refresh_token
    });

    // Create response
    const response = NextResponse.json({ success: true });

    // Store tokens in cookies
    response.cookies.set('spotify_access_token', access_token, {
      maxAge: data.body.expires_in,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    response.cookies.set('spotify_refresh_token', refresh_token, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json({ 
      error: 'Failed to authenticate with Spotify',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 