"use client";

import Image from "next/image";
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

const ink = {
  strokeWidth: 2 as const,
  color: "var(--color-primary)",
  fill: "var(--color-primary)",
};

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [rotation, setRotation] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const animateRef = useRef<(t: number) => void>(() => {});

  const track = tracks[currentTrack]!;

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    setRotation((p) => (p + (delta / 3000) * 360) % 360);
    animationRef.current = requestAnimationFrame((t) => animateRef.current(t));
  }, []);

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
    } else {
      a.play();
      animationRef.current = requestAnimationFrame(animate);
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
    };
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("ended", onEnd);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = null;
    a.load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI when track changes
    setIsPlaying(false);
    setRotation(0);
  }, [track.src]);

  const fade = (show: boolean) => ({
    opacity: show ? 1 : 0,
    filter: show ? ("blur(0px)" as const) : ("blur(4px)" as const),
    transition: "opacity 0.125s ease, filter 0.125s ease",
    pointerEvents: show ? ("auto" as const) : ("none" as const),
  });

  return (
    <div
      role="group"
      aria-label={`Music player: ${track.title} by ${track.artist}`}
      className="music-player cursor-pointer overflow-hidden outline-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-primary)]"
      style={{
        background: "var(--music-player-bg)",
        borderRadius: "8px 26px 26px 8px",
        border: "1.5px solid var(--music-player-border)",
      }}
      onClick={togglePlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 py-1 pl-2 pr-1">
        <audio ref={audioRef} src={track.src} />
        <div className="relative h-9 w-[116px] shrink-0">
          <div className="absolute inset-0 flex flex-col justify-center text-left" style={fade(!hovered)}>
            <span className="truncate text-sm font-medium text-primary">{track.title}</span>
            <span className="truncate text-xs text-secondary">{track.artist}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-2" style={fade(hovered)}>
            <button
              type="button"
              aria-label="Previous track"
              disabled={currentTrack <= 0}
              className="rounded-full p-1 transition-transform hover:scale-125 disabled:cursor-not-allowed disabled:opacity-35"
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack > 0) setCurrentTrack((i) => i - 1);
              }}
            >
              <SkipPrev width={16} height={16} {...ink} />
            </button>
            <button
              type="button"
              aria-label={
                isPlaying
                  ? `Pause: ${track.title} — ${track.artist}`
                  : `Play: ${track.title} — ${track.artist}`
              }
              className="rounded-full p-1 transition-transform hover:scale-125"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              {isPlaying ? (
                <Pause width={20} height={20} {...ink} />
              ) : (
                <Play width={20} height={20} {...ink} />
              )}
            </button>
            <button
              type="button"
              aria-label="Next track"
              disabled={currentTrack >= tracks.length - 1}
              className="rounded-full p-1 transition-transform hover:scale-125 disabled:cursor-not-allowed disabled:opacity-35"
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack < tracks.length - 1) setCurrentTrack((i) => i + 1);
              }}
            >
              <SkipNext width={16} height={16} {...ink} />
            </button>
          </div>
        </div>
        <div className="relative size-10 shrink-0 overflow-hidden rounded-full" style={{ transform: `rotate(${rotation}deg)` }}>
          {track.albumArt ? (
            <Image src={track.albumArt} alt="" width={40} height={40} className="size-full object-cover" draggable={false} />
          ) : (
            <div className="size-full bg-gradient-to-br from-amber-600 to-amber-800" />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(198,198,200,0.75)]" />
          <Image
            src="/music/cd-center.svg"
            alt=""
            width={16}
            height={16}
            unoptimized
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
