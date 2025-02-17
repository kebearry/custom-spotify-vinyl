"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  is_active: boolean;
}

interface PlaylistTrack {
  track: Track;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: {
    items: PlaylistTrack[];
  };
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
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null
  );
  const [isPremium, setIsPremium] = useState<boolean>(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isPremiumChecked, setIsPremiumChecked] = useState<boolean>(false);
  const [showLikeMessage, setShowLikeMessage] = useState(false);
  const [likeMessage, setLikeMessage] = useState("");
  const playlistId = "1odn9BcsovHl9YoaOb38t6";
  const initialCheckDone = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const getCurrentTrack = useCallback(async () => {
    try {
      const now = Date.now();
      if (now - lastApiCall < MIN_API_INTERVAL) {
        return;
      }
      setLastApiCall(now);

      const response = await fetch("/api/spotify/current-track");
      if (!response.ok) {
        throw new Error(`Failed to get current track: ${response.status}`);
      }

      const data = await response.json();

      if (!data.track || !playlist) return;

      // Check if this is a new track
      if (track?.id !== data.track.id) {
        console.log("Track changed:", {
          from: track?.name,
          to: data.track.name,
        });

        // Check if the new track is in playlist
        const trackInPlaylist = playlist.tracks.items.some(
          (item) => item.track.id === data.track.id
        );

        console.log("New track check:", {
          track: data.track.name,
          inPlaylist: trackInPlaylist,
          isPremium,
        });

        // If premium user and track not in playlist, switch to playlist
        if (!trackInPlaylist && isPremium && data.device?.id) {
          console.log("New track not in playlist - switching to playlist");
          setTransitionMessage(
            `Switching from "${data.track.name}" to playlist...`
          );

          const playResponse = await fetch("/api/spotify/play", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deviceId: data.device.id,
              contextUri: `spotify:playlist:${playlistId}`,
              offset: { position: 0 },
              position_ms: 0,
            }),
          });

          if (!playResponse.ok) {
            console.error(
              "Failed to switch to playlist:",
              await playResponse.text()
            );
            setTimeout(() => setTransitionMessage(null), 3000);
          } else {
            setTimeout(() => setTransitionMessage(null), 3000);
          }
        } else if (!trackInPlaylist && !isPremium) {
          // Show manual switch message for non-premium users
          setTransitionMessage(
            `Switching from "${data.track.name}" to playlist...`
          );
          setTimeout(() => setTransitionMessage(null), 3000);
        }
      }

      // Update track state
      setTrack(data.track);
      setIsPlaying(data.isPlaying);
      setDevice(data.device);
      setError(null);
    } catch (error) {
      console.error("Error getting current track:", error);
      if (isPlaying) {
        setIsPlaying(false);
      }
      setError(
        error instanceof Error ? error.message : "Failed to get current track"
      );
    }
  }, [lastApiCall, track, isPlaying, playlist, playlistId, isPremium]);

  const checkAuth = async () => {
    try {
      const response = await fetch(`/api/spotify/playlist?id=${playlistId}`);

      if (!response.ok) {
        let errorMessage;
        try {
          // Try to parse as JSON first
          const data = await response.json();

          // If it's a premium error, we should redirect to upgrade
          if (data.isPremiumError) {
            window.location.href = "/api/auth/login?premium=true";
            return;
          }
          errorMessage = data.error;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage =
            response.status === 404
              ? "Playlist not found. Please check the playlist ID."
              : `Request failed (${response.status})`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load playlist";
      console.warn("Playlist fetch warning:", message);
      throw new Error(message);
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const loadPlaylist = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await checkAuth();

        if (!mounted) return;
        setPlaylist(data);
        setIsAuthenticated(true);
        setError(null);
      } catch (err) {
        if (!mounted) return;

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          // Retry after a delay
          setTimeout(loadPlaylist, 1000 * retryCount);
          setError(`Retrying... (${retryCount}/${MAX_RETRIES})`);
        } else {
          setError(errorMessage);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPlaylist();
    return () => {
      mounted = false;
    };
  }, [playlistId]); // Add other dependencies if needed

  const togglePlayback = async () => {
    try {
      if (!device) {
        setError("Please open Spotify on any device first");
        return;
      }

      if (!track) {
        setError("No track selected");
        return;
      }

      setError(null);

      if (!isPlaying) {
        // Get current playback state to get position
        const playbackResponse = await fetch("/api/spotify/current-track");
        const playbackState = await playbackResponse.json();

        // Starting playback
        const response = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId: device.id,
            trackUri: track.uri,
            contextUri: playlist
              ? `spotify:playlist:${playlist.id}`
              : undefined,
            position_ms: playbackState.progress_ms || 0,
            offset: { uri: track.uri },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to start playback");
        }
      } else {
        // Pausing playback
        const response = await fetch("/api/spotify/pause", { method: "PUT" });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to pause playback");
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      await getCurrentTrack();
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Failed to toggle playback:", error);
      setError(
        error instanceof Error ? error.message : "Failed to toggle playback"
      );
      setIsPlaying(false);
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
      if (!device || !playlist) return;

      // Get current track index
      const currentIndex = playlist.tracks.items.findIndex(
        (item) => item.track.id === track?.id
      );

      // Get next track in playlist
      const nextTrackInPlaylist =
        playlist.tracks.items[currentIndex + 1]?.track;

      if (!nextTrackInPlaylist) {
        // If we're at the end of the playlist, optionally loop to beginning
        return;
      }

      // Play the next track in context
      const response = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: device.id,
          contextUri: `spotify:playlist:${playlist.id}`,
          offset: { uri: nextTrackInPlaylist.uri },
          position_ms: 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to skip to next track");
      }

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

  const fetchPlaylist = useCallback(async () => {
    try {
      const authResponse = await fetch("/api/spotify/check-auth");
      const authData = await authResponse.json();

      if (!authData.authenticated) {
        setError("Not authenticated with Spotify");
        setIsAuthenticated(false);
        return;
      }

      if (!playlistId) {
        setError("No playlist ID provided");
        return;
      }

      const response = await fetch(`/api/spotify/playlist?id=${playlistId}`);

      if (response.status === 429) {
        setError("Rate limit reached. Retrying...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const retryResponse = await fetch(
          `/api/spotify/playlist?id=${playlistId}`
        );
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(
            `Failed to fetch playlist: ${retryResponse.status} - ${
              errorData.error || retryResponse.statusText
            }`
          );
        }
        const data = await retryResponse.json();
        if (!data) {
          throw new Error("No playlist data received");
        }
        setPlaylist(data);
        setError(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to fetch playlist: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }

      const data = await response.json();
      if (!data) {
        throw new Error("No playlist data received");
      }

      setPlaylist(data);
      setError(null);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load playlist"
      );
      setPlaylist(null);

      // If we get a 401 Unauthorized, we should prompt for re-authentication
      if (error instanceof Error && error.message.includes("401")) {
        setIsAuthenticated(false);
      }
    }
  }, [playlistId, setError, setIsAuthenticated, setPlaylist]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlaylist();
    }
  }, [isAuthenticated, fetchPlaylist]);

  useEffect(() => {
    const handlePlaylistEnd = async () => {
      if (track && playlist && !isTransitioning) {
        const isLastTrack =
          playlist.tracks.items[playlist.tracks.items.length - 1].track.id ===
          track.id;
        if (isLastTrack && isPlaying) {
          setIsTransitioning(true);
          await getCurrentTrack();
          setIsTransitioning(false);
        }
      }
    };

    handlePlaylistEnd();
  }, [track, isPlaying, playlist, isTransitioning, getCurrentTrack]);

  const checkForDevices = async () => {
    try {
      const response = await fetch("/api/spotify/devices");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch devices");
      }

      if (!data.devices?.length) {
        setError(
          "No Spotify devices found. Please open Spotify on any device."
        );
        return;
      }

      // Find an active device or use the first available one
      const activeDevice =
        data.devices.find((d: SpotifyDevice) => d.is_active) || data.devices[0];
      setDevice(activeDevice);
      setError(null);

      // If we found an active device, start our playlist
      if (activeDevice) {
        const playResponse = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId: activeDevice.id,
            contextUri: `spotify:playlist:${playlistId}`,
            position_ms: 0,
          }),
        });

        if (!playResponse.ok) {
          const error = await playResponse.json();
          console.error("Failed to start playlist:", error);
          setError("Failed to start playlist. Please try again.");
        } else {
          setIsPlaying(true);
          getCurrentTrack(); // Update the current track display
        }
      }
    } catch (error) {
      console.error("Error checking devices:", error);
      setError("Failed to check for Spotify devices. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/spotify/logout", { method: "POST" });
      setIsAuthenticated(false);
      setDevice(null);
      setTrack(null);
      setIsPlaying(false);
      // Optionally redirect to home or refresh the page
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to logout. Please try again.");
    }
  };

  // Reset the switch completion when the component unmounts
  useEffect(() => {
    return () => {
      initialCheckDone.current = false;
    };
  }, []);

  const playTrack = async (selectedTrack: Track) => {
    try {
      if (!device || !playlist) return;

      const response = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: device.id,
          contextUri: `spotify:playlist:${playlist.id}`,
          offset: { uri: selectedTrack.uri },
          position_ms: 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to play selected track");
      }

      setTimeout(() => {
        getCurrentTrack();
        getQueueInfo();
      }, 300);
    } catch (error) {
      console.error("Error playing track:", error);
      setError(error instanceof Error ? error.message : "Failed to play track");
    }
  };

  // Check if track is saved
  const checkIsTrackSaved = async (trackId: string) => {
    try {
      const response = await fetch(
        `/api/spotify/check-saved-tracks?ids=${trackId}`
      );
      if (!response.ok) throw new Error("Failed to check saved track");

      const data = await response.json();
      setIsLiked(data[0]);
    } catch (error) {
      console.error("Error checking saved track:", error);
    }
  };

  // Toggle saved status
  const toggleSaved = async () => {
    if (!track) return;

    try {
      const endpoint = isLiked ? "remove-saved-track" : "save-track";

      const response = await fetch(`/api/spotify/${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId: track.id }),
      });

      if (!response.ok)
        throw new Error(`Failed to ${isLiked ? "remove" : "save"} track`);

      setIsLiked(!isLiked);

      // Show message
      setLikeMessage(
        isLiked ? "Removed from Liked Songs" : "Added to Liked Songs"
      );
      setShowLikeMessage(true);
      setTimeout(() => setShowLikeMessage(false), 2000);
    } catch (error) {
      console.error("Error toggling saved status:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update liked status"
      );
    }
  };

  // Check saved status when track changes
  useEffect(() => {
    if (track) {
      checkIsTrackSaved(track.id);
    }
  }, [track]);

  // Modify the useEffect for premium check
  useEffect(() => {
    const checkPremiumStatus = async () => {
      try {
        const response = await fetch("/api/spotify/me");

        if (!response.ok) {
          // Don't try to parse non-OK responses as JSON
          throw new Error(
            `Failed to check premium status (${response.status})`
          );
        }

        const data = await response.json();
        return data.isPremium === true;
      } catch {
        console.warn("Failed to parse premium status response");
        return false;
      }
    };

    let mounted = true;

    const checkStatus = async () => {
      try {
        const isPremium = await checkPremiumStatus();
        if (mounted) {
          setIsPremium(isPremium);
          setIsPremiumChecked(true);
        }
      } catch (error) {
        if (mounted) {
          console.warn(
            "Premium check failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          setIsPremium(false);
          setIsPremiumChecked(true);
        }
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // Add debug logging for state changes
  useEffect(() => {
    console.log(
      "State update - isPremium:",
      isPremium,
      "isPremiumChecked:",
      isPremiumChecked
    );
  }, [isPremium, isPremiumChecked]);

  // Device check conditional return
  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 w-full max-w-md mx-auto">
        <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-xl border border-slate-700">
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-2">
              Connect to Spotify
            </h2>
            <p className="text-slate-400">
              Follow these steps to start using the vinyl player
            </p>
          </div>

          {/* Instructions */}
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  1
                </div>
                <div>
                  <h3 className="text-white font-medium mb-2">
                    Connect your Spotify account
                  </h3>
                  <div className="mb-3">
                    {isAuthenticated ? (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-4 py-2 rounded-lg animate-fade-in">
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Successfully connected to Spotify!</span>
                      </div>
                    ) : (
                      <a
                        href={LOGIN_URL}
                        className="inline-flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] 
                                 text-white font-bold py-3 px-6 rounded-full 
                                 transition-all duration-200 transform hover:scale-105
                                 shadow-lg hover:shadow-[#1DB954]/30"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        Connect with Spotify
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  2
                </div>
                <div>
                  <h3 className="text-white font-medium mb-2">
                    Open Spotify on any device
                  </h3>
                  <ul className="space-y-1 text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Spotify Desktop App
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Spotify Mobile App
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Spotify Web Player
                    </li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  3
                </div>
                <div>
                  <h3 className="text-white font-medium">
                    Play any song briefly
                  </h3>
                  <p className="text-slate-400 mt-1">
                    This will activate your device
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  4
                </div>
                <div>
                  <h3 className="text-white font-medium">Check connection</h3>
                  <p className="text-slate-400 mt-1">
                    Click the button below to connect
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={checkForDevices}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium 
                       py-3 px-6 rounded-lg transition-colors duration-200 
                       flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Check for Spotify Devices</span>
            </button>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 bg-slate-900/50">
            <p className="text-slate-400 text-sm text-center">
              Need help? Make sure you&apos;re logged into the correct Spotify
              account
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Auth check conditional return
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 w-full max-w-md mx-auto">
        <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-xl border border-slate-700">
          <div className="p-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Connect Your Spotify Account
            </h2>
            <p className="text-slate-400 mb-6">
              To use the vinyl player, you&apos;ll need to connect your Spotify
              account first
            </p>
            <a
              href={LOGIN_URL}
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium 
                       py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg"
            >
              Connect to Spotify
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 md:p-8">
      {/* Fixed Mobile Container */}
      <div className="w-full md:static fixed top-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-sm pt-4 pb-6 md:pt-0 md:pb-0 md:bg-transparent md:backdrop-blur-none flex flex-col items-center">
        {/* Record Player */}
        <div className="w-full max-w-[500px] px-4 sm:px-0">
          {/* Dust Cover */}
          <div className="absolute top-0 left-0 right-0 h-[420px] bg-amber-50/5 rounded-t-lg backdrop-blur-sm pointer-events-none" />

          {/* Record Player Base */}
          <div className="relative w-full h-[400px] bg-gradient-to-br from-amber-950 to-stone-950 rounded-lg shadow-lg p-4 sm:p-8 border border-amber-900/30 flex items-center justify-center">
            {/* Wood grain effect */}
            <div
              className="absolute inset-0 rounded-lg opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width=&apos;100&apos; height=&apos;100&apos; viewBox=&apos;0 0 100 100&apos; xmlns=&apos;http://www.w3.org/2000/svg&apos;%3E%3Cfilter id=&apos;noise&apos;%3E%3CfeTurbulence type=&apos;fractalNoise&apos; baseFrequency=&apos;0.8&apos; numOctaves=&apos;4&apos; stitchTiles=&apos;stitch&apos;/%3E%3C/filter%3E%3Crect width=&apos;100&apos; height=&apos;100&apos; filter=&apos;url(%23noise)&apos; opacity=&apos;0.5&apos;/%3E%3C/svg%3E")`,
              }}
            />

            {/* Turntable Platter */}
            <div className="relative w-[250px] h-[250px] sm:w-[300px] sm:h-[300px] bg-stone-800 rounded-full shadow-inner border border-amber-900/20">
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
                      width={250}
                      height={250}
                      style={{
                        width: "100%",
                        height: "100%",
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

        {/* Controls Section */}
        <div className="w-full max-w-[500px] px-4 sm:px-0 mt-6">
          {/* Top Section - Device Info with Logout */}
          {device && (
            <div className="px-6 py-3 border-b border-sky-500/20 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm text-sky-200/80">
                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-lg shadow-sky-400/50" />
                <span>{device.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-sky-300/50 font-medium">
                  {device.type}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1 bg-red-500/10 hover:bg-red-500/20 
                           text-red-400 rounded-full transition-colors duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {/* Middle Section - Track Info */}
          {track && (
            <div className="px-6 py-4 text-center border-b border-sky-500/20 bg-gradient-to-b from-slate-900/50 to-transparent">
              <div className="flex items-center justify-center gap-3">
                <h2 className="font-semibold text-lg text-sky-100">
                  {track.name}
                </h2>
                {/* Like Button - Increased size */}
                <button
                  onClick={toggleSaved}
                  className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
                    isLiked
                      ? "text-red-500"
                      : "text-sky-400/70 hover:text-red-500"
                  }`}
                >
                  {isLiked ? (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
                    </svg>
                  )}
                </button>
              </div>
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
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
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
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Below Fixed Player */}
      <div className="w-full mt-[750px] md:mt-0 flex flex-col items-center">
        {/* Song Notes */}
        {track && (
          <div className="w-full max-w-[500px] px-4 sm:px-0">
            <SongNotes trackId={track.id} trackName={track.name} />
          </div>
        )}

        {/* Track List */}
        {playlist && (
          <div className="w-full max-w-[500px] px-4 sm:px-0 bg-white rounded-lg border border-slate-200 mt-4 shadow-lg overflow-hidden">
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
                  {playlist.tracks.items.length} tracks
                </span>
              </div>
            </div>

            {/* Tracks List */}
            <div className="max-h-[400px] overflow-y-auto">
              {playlist.tracks.items.map((playlistTrack, index) => (
                <div
                  key={playlistTrack.track.id}
                  onClick={() => playTrack(playlistTrack.track)}
                  className={`group flex items-center gap-4 px-6 py-4 transition-all duration-200 border-b border-slate-100 cursor-pointer 
                    ${
                      track?.id === playlistTrack.track.id
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    }`}
                >
                  {/* Track Number */}
                  <span
                    className={`w-8 text-right font-medium ${
                      track?.id === playlistTrack.track.id
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
                          track?.id === playlistTrack.track.id
                            ? "text-blue-900"
                            : "text-slate-700"
                        }`}
                      >
                        {playlistTrack.track.name}
                      </p>

                      {/* Playing Indicator */}
                      {track?.id === playlistTrack.track.id && isPlaying && (
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
                        track?.id === playlistTrack.track.id
                          ? "text-blue-600"
                          : "text-slate-500"
                      }`}
                    >
                      {playlistTrack.track.artists
                        ?.map((artist) => artist.name)
                        .join(", ")}
                    </p>
                  </div>

                  {/* Play Button - Always visible with enhanced styling */}
                  <div className="flex-shrink-0">
                    <button
                      className={`p-3 rounded-full transition-all duration-200 ${
                        track?.id === playlistTrack.track.id
                          ? isPlaying
                            ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(playlistTrack.track);
                      }}
                    >
                      {track?.id === playlistTrack.track.id && isPlaying ? (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
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

      {/* Transition Message */}
      {transitionMessage && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 border border-zinc-800 text-white px-8 py-6 rounded-xl shadow-2xl max-w-md mx-4 animate-fade-in">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-500 rounded-full animate-spin" />
              <div>
                <p className="text-zinc-400 mb-2">Currently playing:</p>
                <p className="text-lg font-medium mb-3 text-white">
                  {track?.name}
                </p>
                <p className="text-zinc-400 mb-2">Switching to:</p>
                <p className="text-lg font-medium text-emerald-400">
                  Playlist: {playlist?.name || "Custom Playlist"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Status Message */}
      {isAuthenticated && isPremiumChecked && isPremium === false && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-slate-900 p-6 rounded-lg shadow-xl border border-sky-500/20 max-w-md mx-4">
            <h3 className="text-xl font-semibold text-sky-100 mb-2">
              Spotify Premium Required
            </h3>
            <p className="text-sky-200/70">
              This feature requires a Spotify Premium subscription to work.
            </p>
          </div>
        </div>
      )}

      {/* Checking Premium Status */}
      {isAuthenticated && !isPremiumChecked && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-slate-900 p-6 rounded-lg shadow-xl border border-sky-500/20 max-w-md mx-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-sky-100 mb-2">
                Checking Subscription Status
              </h3>
              <div className="flex justify-center gap-1">
                <div
                  className="w-2 h-2 bg-sky-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-sky-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-sky-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Like Message Toast */}
      {showLikeMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <div
            className={`px-6 py-3 rounded-lg shadow-lg border flex items-center gap-2 ${
              isLiked
                ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                : "bg-slate-100 border-slate-200 text-slate-800"
            }`}
          >
            <svg
              className={`w-5 h-5 ${
                isLiked ? "text-emerald-600" : "text-slate-600"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span className="font-medium">{likeMessage}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="status-message loading">Loading playlist...</div>
      )}

      {error && <div className="status-message error">{error}</div>}
    </div>
  );
}

function decodeHTMLEntities(text: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
