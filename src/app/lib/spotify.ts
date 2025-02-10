import SpotifyWebApi from "spotify-web-api-node";

if (!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID) {
  throw new Error("Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID environment variable");
}

if (!process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
  throw new Error("Missing NEXT_PUBLIC_SPOTIFY_REDIRECT_URI environment variable");
}

const scopes = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");

// Create params object first for better readability
const authParams = {
  client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  response_type: "code",
  redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
  scope: scopes,
  show_dialog: "true",
} as const;

const LOGIN_URL =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams(authParams).toString();

// Initialize with only the client-side needed credentials
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
});

// Helper function to set the access token
const setAccessToken = (token: string) => {
  spotifyApi.setAccessToken(token);
};

export const PLAYLIST_URI = "spotify:playlist:YOUR_PLAYLIST_ID";
export const PLAYLIST_ID = "YOUR_PLAYLIST_ID"; // The ID part only

export { LOGIN_URL, setAccessToken };
export default spotifyApi;
