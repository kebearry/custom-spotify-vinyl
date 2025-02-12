import SpotifyWebApi from "spotify-web-api-node";

if (!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID) {
  throw new Error("Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID environment variable");
}

if (!process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
  throw new Error(
    "Missing NEXT_PUBLIC_SPOTIFY_REDIRECT_URI environment variable"
  );
}

const redirectUri = process.env.NODE_ENV === 'production'
  ? 'https://custom-spotify-vinyl.vercel.app/api/auth/callback/spotify'
  : 'http://localhost:3000/api/auth/callback/spotify';

const scopes = [
  // Playback scopes
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  
  // Playlist scopes
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  
  // User scopes
  'user-read-email',
  'user-read-private',
  
  // Queue scopes
  'user-read-playback-queue',
  
  // Additional playback scopes
  'app-remote-control',
  'user-read-playback-position'
].join(' ');

const params = {
  scope: scopes,
  response_type: 'code',
  client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  redirect_uri: redirectUri,
  show_dialog: 'true'
};

export const LOGIN_URL = 'https://accounts.spotify.com/authorize?' + new URLSearchParams(params);

// Initialize with only the client-side needed credentials
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  redirectUri: redirectUri, // Use the processed redirect URI
});

// Helper function to set the access token
const setAccessToken = (token: string) => {
  spotifyApi.setAccessToken(token);
};

export const PLAYLIST_URI = "spotify:playlist:YOUR_PLAYLIST_ID";
export const PLAYLIST_ID = "YOUR_PLAYLIST_ID"; // The ID part only

export { setAccessToken };
export default spotifyApi;
