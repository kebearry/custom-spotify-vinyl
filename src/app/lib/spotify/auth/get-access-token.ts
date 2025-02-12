import { cookies } from 'next/headers';

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  
  if (!accessToken) {
    return null;
  }

  return accessToken;
} 