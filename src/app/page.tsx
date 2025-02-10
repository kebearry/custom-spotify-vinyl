"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import VinylPlayer from "./components/VinylPlayer";

function SpotifyCallback() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");

    if (code) {
      console.log("Received Spotify code:", code); // Debug log
      setIsLoading(true);
      // Handle Spotify callback
      fetch(`/api/auth/callback/spotify?code=${code}`)
        .then((res) => {
          console.log("API response status:", res.status); // Debug log
          return res.json();
        })
        .then((data) => {
          console.log("API response data:", data); // Debug log
          if (data.success) {
            // Refresh the page to clear the URL params
            window.location.href = "/";
          }
        })
        .catch((error) => {
          console.error("Error handling Spotify callback:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [searchParams]);

  return isLoading ? (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">
          Connecting to Spotify...
        </h1>
        <p>Please wait while we complete the authentication.</p>
      </div>
    </div>
  ) : <VinylPlayer track={null} />;
}

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950">
      <Suspense fallback={<div>Loading...</div>}>
        <SpotifyCallback />
      </Suspense>
    </main>
  );
}
