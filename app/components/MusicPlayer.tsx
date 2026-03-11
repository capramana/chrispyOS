"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SkipPrev, Play, Pause, SkipNext } from "iconoir-react";

interface Track {
  title: string;
  artist: string;
  src: string;
  albumArt?: string;
}

const tracks: Track[] = [
  {
    title: "Carlos (Freddit2B)",
    artist: "Fred again..",
    src: "/music/songs/Carlos(Freddit2B).mp3",
    albumArt: "/music/covers/carlos.jpg",
  },
];

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack] = useState(0);
  const [rotation, setRotation] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const track = tracks[currentTrack];

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = timestamp;
    }

    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Rotate 360 degrees every 3 seconds (same as animate-spin-slow)
    setRotation((prev) => (prev + (delta / 3000) * 360) % 360);

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        lastTimeRef.current = null;
      } else {
        audioRef.current.play();
        animationRef.current = requestAnimationFrame(animate);
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => {
        setIsPlaying(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        lastTimeRef.current = null;
      };
      audio.addEventListener("ended", handleEnded);
      return () => {
        audio.removeEventListener("ended", handleEnded);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, []);

  return (
    <div
      className="group cursor-pointer overflow-hidden"
      style={{
        background: "var(--music-player-bg)",
        borderRadius: "8px 26px 26px 8px",
        border: "1.5px solid var(--music-player-border)",
      }}
      onClick={togglePlay}
    >
      <div className="flex items-center gap-2 pl-2 pr-1 py-1">
      <audio ref={audioRef} src={track.src} />

      {/* Track info - visible by default, hidden on hover */}
      <div className="flex flex-col text-left group-hover:hidden w-[116px] flex-shrink-0">
        <span className="text-sm font-medium text-primary truncate">
          {track.title}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--color-secondary)" }}>{track.artist}</span>
      </div>

      {/* Controls - hidden by default, visible on hover */}
      <div className="hidden group-hover:flex items-center justify-center gap-2 w-[116px]">
        {/* Previous */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Previous track logic
          }}
          className="p-1 rounded-full transition-transform hover:scale-125"
        >
          <SkipPrev width={16} height={16} strokeWidth={2} color="var(--color-primary)" fill="var(--color-primary)" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="p-1 rounded-full transition-transform hover:scale-125"
        >
          {isPlaying ? (
            <Pause width={20} height={20} strokeWidth={2} color="var(--color-primary)" fill="var(--color-primary)" />
          ) : (
            <Play width={20} height={20} strokeWidth={2} color="var(--color-primary)" fill="var(--color-primary)" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Next track logic
          }}
          className="p-1 rounded-full transition-transform hover:scale-125"
        >
          <SkipNext width={16} height={16} strokeWidth={2} color="var(--color-primary)" fill="var(--color-primary)" />
        </button>
      </div>
      <div
        className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-800" />
        )}
        {/* Inner outline */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(198,198,200,0.75)]" />
        {/* CD center */}
        <img
          src="/music/cd-center.svg"
          alt=""
          width={16}
          height={16}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      </div>
      </div>
    </div>
  );
}
