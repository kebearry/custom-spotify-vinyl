import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear all Spotify related cookies
    const cookieStore = await cookies();
    cookieStore.delete('spotify_access_token');
    cookieStore.delete('spotify_refresh_token');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
} 