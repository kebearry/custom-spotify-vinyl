"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { LOGIN_URL } from "../lib/spotify";
import SongNotes from "./SongNotes";

const MIN_API_INTERVAL = 1000; // Minimum time between API calls in milliseconds

interface Track {
  id: string;
  name: string;
  uri: string;
  album: {
    images: { url: string }[];
  };
  artists: { name: string }[];
  duration_ms?: number;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  images: { url: string }[];
}

export default function VinylPlayer({
  track: initialTrack,
}: {
  track: Track | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [track, setTrack] = useState<Track | null>(initialTrack);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<SpotifyDevice | null>(null);
  const [previousTrack, setPreviousTrack] = useState<Track | null>(null);
  const [nextTrack, setNextTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastApiCall, setLastApiCall] = useState(0);

  const checkTrackInPlaylist = (
    currentTrack: Track | null,
    playlistTracks: Track[]
  ) => {
    if (!currentTrack || !playlistTracks) return false;
    return playlistTracks.some(
      (playlistTrack) => playlistTrack.id === currentTrack.id
    );
  };

  const getCurrentTrack = useCallback(async () => {
    try {
      const now = Date.now();
      if (now - lastApiCall < MIN_API_INTERVAL) {
        return;
      }
      setLastApiCall(now);

      const response = await fetch('/api/spotify/current-track');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      // Only update if something has changed
      if (
        !track || 
        track.id !== data.track?.id || 
        isPlaying !== data.isPlaying
      ) {
        setTrack(data.track);
        setIsPlaying(data.isPlaying);
        setDevice(data.device);
        setError(null);

        // Check playlist context only when track changes
        if (playlist && data.track) {
          const inPlaylist = checkTrackInPlaylist(data.track, playlist.tracks);
          
          if (!inPlaylist) {
            await fetch('/api/spotify/pause', { method: 'POST' });
            setError('Playback limited to playlist tracks only');
          }
        }
      }
    } catch (error) {
      console.error('Error getting current track:', error);
      if (error && typeof error === 'object' && 'statusCode' in error) {
        if (error.statusCode === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }, [lastApiCall, track, isPlaying, playlist]);

  useEffect(() => {
    // Check if we have an access token in cookies
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/spotify/check-auth");
        const data = await response.json();

        if (data.authenticated) {
          setIsAuthenticated(true);
          // Get current playing track
          getCurrentTrack();
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };

    checkAuth();
    // Poll less frequently (every 10 seconds instead of 5)
    const interval = setInterval(getCurrentTrack, 10000);
    return () => clearInterval(interval);
  }, [getCurrentTrack]);

  const togglePlayback = async () => {
    try {
      if (!device) {
        setError("Please open Spotify on any device first");
        return;
      }

      setError(null);
      const response = await fetch("/api/spotify/toggle-playback", {
        method: "POST",
        body: JSON.stringify({ play: !isPlaying }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle playback");
      }

      // Update track info after toggling playback
      getCurrentTrack();
    } catch (error) {
      console.error("Failed to toggle playback:", error);
      setError(
        error instanceof Error ? error.message : "Failed to toggle playback"
      );
    }
  };

  const getQueueInfo = async () => {
    try {
      const response = await fetch("/api/spotify/queue");
      const data = await response.json();

      if (data.error) {
        console.error("Queue error:", data.error);
        return;
      }

      setPreviousTrack(data.previous);
      setNextTrack(data.next);
    } catch (error) {
      console.error("Error getting queue:", error);
    }
  };

  useEffect(() => {
    const checkCurrentTrack = async () => {
      try {
        await getCurrentTrack();
        await getQueueInfo();
      } catch (error) {
        console.error(error);
      }
    };

    if (isAuthenticated) {
      checkCurrentTrack();
      const interval = setInterval(checkCurrentTrack, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, getCurrentTrack]);

  const skipToNext = async () => {
    try {
      await fetch("/api/spotify/next-track", { method: "POST" });
      setTimeout(() => {
        getCurrentTrack();
        getQueueInfo();
      }, 300);
    } catch (error) {
      console.error("Error skipping track:", error);
    }
  };

  const skipToPrevious = async () => {
    try {
      await fetch("/api/spotify/previous-track", { method: "POST" });
      setTimeout(() => {
        getCurrentTrack();
        getQueueInfo();
      }, 300);
    } catch (error) {
      console.error("Error going to previous track:", error);
    }
  };

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        const response = await fetch("/api/spotify/playlist");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setPlaylist(data.playlist);
      } catch (error) {
        console.error("Error fetching playlist:", error);
        setError("Failed to fetch playlist");
      }
    };

    if (isAuthenticated) {
      fetchPlaylist();
    }
  }, [isAuthenticated]);

  const startPlaylist = async () => {
    try {
      const response = await fetch("/api/spotify/playlist", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start playlist");
      }

      // Wait a bit for Spotify to start playing
      setTimeout(getCurrentTrack, 500);
    } catch (error) {
      console.error("Error starting playlist:", error);
      setError("Failed to start playlist");
    }
  };

  useEffect(() => {
    const handlePlaylistEnd = async () => {
      if (track && playlist && !isTransitioning) {
        const isLastTrack =
          playlist.tracks[playlist.tracks.length - 1].id === track.id;
        if (isLastTrack && isPlaying) {
          setIsTransitioning(true);
          await getCurrentTrack();
          setIsTransitioning(false);
        }
      }
    };

    handlePlaylistEnd();
  }, [track, isPlaying, playlist, isTransitioning, getCurrentTrack]);

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center p-4">
        <a
          href={LOGIN_URL}
          className="px-6 py-2 text-sky-100 bg-sky-600 rounded-full hover:bg-sky-500 transition-colors duration-200 shadow-md"
        >
          Connect to Spotify
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Playlist Info */}
      {playlist && !track && (
        <div className="w-[500px] text-center">
          <h2 className="text-xl font-semibold text-sky-100 mb-2">
            {playlist.name}
          </h2>
          <p className="text-sky-200/70 mb-4">{playlist.description}</p>
          <button
            onClick={startPlaylist}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full transition-colors shadow-lg"
          >
            Start Listening
          </button>
        </div>
      )}

      {error && (
        <div
          className={`text-center w-[500px] p-3 rounded-lg ${
            error === "Playlist ended"
              ? "bg-blue-100 text-blue-800 border border-blue-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          <p>{error}</p>
          {error === "Playlist ended" && (
            <button
              onClick={startPlaylist}
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 transition-colors"
            >
              Replay Playlist
            </button>
          )}
        </div>
      )}

      {/* Record Player */}
      <div className="w-[500px]">
        {/* Dust Cover - removed the negative margins */}
        <div className="absolute top-0 left-0 right-0 h-[420px] bg-amber-50/5 rounded-t-lg backdrop-blur-sm pointer-events-none" />

        {/* Record Player Base - adjusted shadow */}
        <div className="relative w-full h-[400px] bg-gradient-to-br from-amber-950 to-stone-950 rounded-lg shadow-lg p-8 border border-amber-900/30">
          {/* Wood grain effect */}
          <div
            className="absolute inset-0 rounded-lg opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Turntable Platter */}
          <div className="relative w-[300px] h-[300px] mx-auto bg-stone-800 rounded-full shadow-inner border border-amber-900/20">
            {/* Platter Mat */}
            <div
              className="absolute inset-0 rounded-full bg-stone-900"
              style={{
                backgroundImage: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%)`,
              }}
            />

            {track && (
              <div
                className={`absolute inset-0 transition-transform duration-500 ${
                  isPlaying ? "animate-spin-slow" : ""
                }`}
              >
                {/* Vinyl Record */}
                <div className="relative w-full h-full">
                  <Image
                    src={track.album.images[0].url}
                    alt={track.name}
                    className="rounded-full shadow-lg"
                    width={300}
                    height={300}
                    style={{
                      filter: "brightness(0.9) contrast(1.1)",
                    }}
                  />

                  {/* Vinyl grooves */}
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-black/20 to-black/10"
                    style={{
                      backgroundImage: `repeating-radial-gradient(
                           circle at center,
                           rgba(0,0,0,0.1) 0px,
                           rgba(0,0,0,0.1) 1px,
                           transparent 1px,
                           transparent 4px
                         )`,
                    }}
                  />

                  {/* Label */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[80px] rounded-full bg-gradient-to-br from-amber-900 to-stone-900">
                    <div className="absolute inset-0 rounded-full border-[3px] border-amber-800/50" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[8px] h-[8px] rounded-full bg-stone-800 border-2 border-amber-700" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tonearm */}
          <div
            className={`absolute top-8 right-8 w-[120px] h-[120px] transition-transform duration-700 origin-bottom-right ${
              isPlaying ? "rotate-12" : "-rotate-12"
            }`}
          >
            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-gradient-to-br from-amber-700 to-amber-900" />{" "}
            {/* Base */}
            <div className="absolute bottom-0 right-2 w-1 h-[120px] bg-gradient-to-r from-amber-700 to-amber-800 origin-bottom transform -rotate-45" />{" "}
            {/* Arm */}
            <div className="absolute top-0 left-0 w-8 h-2 bg-gradient-to-br from-amber-700 to-amber-900" />{" "}
            {/* Headshell */}
          </div>
        </div>
      </div>

      {/* New Controls Section with blue/silver theme */}
      <div className="w-[500px] bg-gradient-to-br from-slate-900/95 to-slate-950/95 rounded-lg backdrop-blur-sm border border-sky-400/20 shadow-lg shadow-sky-500/5">
        {/* Top Section - Device Info */}
        {device && (
          <div className="px-6 py-3 border-b border-sky-500/20 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2 text-sm text-sky-200/80">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-lg shadow-sky-400/50" />
              <span>{device.name}</span>
            </div>
            <div className="text-xs text-sky-300/50 font-medium">
              {device.type}
            </div>
          </div>
        )}

        {/* Middle Section - Track Info */}
        {track && (
          <div className="px-6 py-4 text-center border-b border-sky-500/20 bg-gradient-to-b from-slate-900/50 to-transparent">
            <h2 className="font-semibold text-lg text-sky-100 mb-1">
              {track.name}
            </h2>
            <p className="text-sm text-sky-300/70">
              {track.artists?.map((artist) => artist.name).join(", ")}
            </p>
          </div>
        )}

        {/* Bottom Section - Controls */}
        <div className="px-6 py-4">
          {/* Track Navigation Preview */}
          <div className="flex justify-between items-center text-xs text-sky-200/60 mb-2">
            <div className="w-1/3 text-left truncate">
              {previousTrack?.name || "No previous track"}
            </div>
            <div className="w-1/3 text-center">{/* Spacer */}</div>
            <div className="w-1/3 text-right truncate">
              {nextTrack?.name || "No next track"}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center">
            {/* Previous Track */}
            <button
              onClick={skipToPrevious}
              disabled={!previousTrack}
              className="text-sky-400/70 hover:text-sky-300 disabled:text-sky-400/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlayback}
              disabled={!device}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 ${
                device
                  ? "bg-gradient-to-br from-sky-500 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 ring-1 ring-sky-400/50"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {isPlaying ? (
                <svg
                  className="w-6 h-6 drop-shadow"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 drop-shadow"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={skipToNext}
              disabled={!nextTrack}
              className="text-sky-400/70 hover:text-sky-300 disabled:text-sky-400/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Add SongNotes component */}
      {track && <SongNotes trackId={track.id} trackName={track.name} />}

      {/* Track List with improved styling */}
      {playlist && (
        <div className="w-[500px] bg-white rounded-lg border border-slate-200 mt-4 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-blue-950">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium text-lg">
                  Playlist Tracks
                </h3>
                <p className="text-blue-200 text-sm mt-1">{playlist.name}</p>
              </div>
              <span className="px-3 py-1 bg-blue-800/50 rounded-full text-blue-100 text-sm">
                {playlist.tracks.length} tracks
              </span>
            </div>
          </div>

          {/* Tracks List */}
          <div className="max-h-[400px] overflow-y-auto">
            {playlist.tracks.map((playlistTrack, index) => (
              <div
                key={playlistTrack.id}
                className={`group flex items-center gap-4 px-6 py-4 transition-all duration-200 border-b border-slate-100 ${
                  track?.id === playlistTrack.id
                    ? "bg-blue-50"
                    : "hover:bg-slate-50"
                }`}
              >
                {/* Track Number */}
                <span
                  className={`w-8 text-right font-medium ${
                    track?.id === playlistTrack.id
                      ? "text-blue-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  {(index + 1).toString().padStart(2, "0")}
                </span>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate font-medium ${
                        track?.id === playlistTrack.id
                          ? "text-blue-900"
                          : "text-slate-700"
                      }`}
                    >
                      {playlistTrack.name}
                    </p>

                    {/* Playing Indicator */}
                    {track?.id === playlistTrack.id && (
                      <div className="flex items-center gap-[2px]">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-[3px] h-[12px] bg-blue-600 rounded-full animate-pulse"
                            style={{
                              animationDelay: `${i * 0.15}s`,
                              height: `${8 + Math.random() * 8}px`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Artists */}
                  <p
                    className={`text-sm truncate mt-1 ${
                      track?.id === playlistTrack.id
                        ? "text-blue-600"
                        : "text-slate-500"
                    }`}
                  >
                    {playlistTrack.artists
                      ?.map((artist) => artist.name)
                      .join(", ")}
                  </p>
                </div>

                {/* Duration or other metadata could go here */}
                <div
                  className={`text-sm ${
                    track?.id === playlistTrack.id
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  {/* You could add track duration here if available */}
                </div>
              </div>
            ))}
          </div>

          {/* Footer with left-aligned description */}
          {playlist.description && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                {decodeHTMLEntities(playlist.description)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function decodeHTMLEntities(text: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
