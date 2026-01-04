"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSystemSetting } from "@/app/[locale]/(app)/admin/actions";

interface MusicContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (val: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true); // Default to playing
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.3); // Default 30%
  const [src, setSrc] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playlist, setPlaylist] = useState<{ name: string; url: string }[]>([]);
  const [isCycling, setIsCycling] = useState(true);

  // Load settings and playlist
  useEffect(() => {
    // Load preference from local storage
    const storedMute = localStorage.getItem("bq_music_muted");
    const storedVol = localStorage.getItem("bq_music_volume");
    const storedPlaying = localStorage.getItem("bq_music_playing");
    if (storedMute !== null) setIsMuted(storedMute === "true");
    if (storedVol !== null) setVolumeState(parseFloat(storedVol));
    if (storedPlaying !== null) setIsPlaying(storedPlaying === "true");

    // Listen for custom event from admin settings change
    const handleSettingsChange = (e: CustomEvent) => {
      if (e.detail?.url) setSrc(e.detail.url);
      if (e.detail?.cycling !== undefined) setIsCycling(e.detail.cycling);
      if (e.detail?.refreshPlaylist) fetchPlaylist();
    };
    window.addEventListener(
      "music-settings-changed",
      handleSettingsChange as EventListener
    );

    const fetchPlaylist = () => {
      fetch("/api/music/list")
        .then((res) => res.json())
        .then((data) => setPlaylist(data || []));
    };

    // Initial fetch
    getSystemSetting("background_music_url").then((url) => {
      if (url) {
        setSrc(url);
      } else {
        setSrc("/background_music/thief_in_the_night.mp3");
      }
    });

    getSystemSetting("background_music_cycle").then((val) => {
      setIsCycling(val !== "false"); // Default to true unless explicitly "false"
    });

    fetchPlaylist();

    // Global interaction listener to unlock audio
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      window.removeEventListener(
        "music-settings-changed",
        handleSettingsChange as EventListener
      );
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  // Handle Audio Element and Cycling
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = false; // We handle loop via ended event for cycling
    }

    const audio = audioRef.current;

    const playNext = () => {
      if (!isCycling || playlist.length === 0) {
        audio.currentTime = 0;
        audio.play();
        return;
      }

      const currentIndex = playlist.findIndex((track) =>
        audio.src.endsWith(track.url)
      );
      const nextIndex = (currentIndex + 1) % playlist.length;
      const nextTrack = playlist[nextIndex];

      if (nextTrack) {
        setSrc(nextTrack.url);
      }
    };

    audio.onended = playNext;

    if (src && !audio.src.endsWith(src)) {
      audio.src = src;
    }

    audio.muted = isMuted;
    audio.volume = volume;

    if (isPlaying && src) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Autoplay prevented (waiting for interaction):", error);
          // If it was blocked, we should probably reflect that it's NOT playing
          setIsPlaying(false);
          localStorage.setItem("bq_music_playing", "false");
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, isMuted, volume, src, hasInteracted, isCycling, playlist]);

  const togglePlay = () => {
    setHasInteracted(true);
    setIsPlaying((prev) => {
      const newVal = !prev;
      localStorage.setItem("bq_music_playing", String(newVal));
      return newVal;
    });
  };

  const toggleMute = () => {
    const newVal = !isMuted;
    setIsMuted(newVal);
    localStorage.setItem("bq_music_muted", String(newVal));
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    localStorage.setItem("bq_music_volume", String(val));
    if (val > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem("bq_music_muted", "false");
    }
    setHasInteracted(true);
  };

  return (
    <MusicContext.Provider
      value={{ isPlaying, isMuted, volume, togglePlay, toggleMute, setVolume }}
    >
      {children}
    </MusicContext.Provider>
  );
}
