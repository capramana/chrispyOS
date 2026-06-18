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
    title: "Carlos(Freddit2B)",
    artist: "Fred again..",
    src: "/music/songs/Carlos(Freddit2B).mp3",
    albumArt: "/music/covers/carlos.jpg",
  },
  {
    title: "Fleur-De-Lis",
    artist: "Jenevieve, Lous and the Yakuza",
    src: "/music/songs/Fleur-De-Lis.mp3",
    albumArt: "/music/covers/fleur-de-lis.png",
  },
  {
    title: "Teach Me How To Love",
    artist: "Galdive",
    src: "/music/songs/Teach-Me-How-To-Love.mp3",
    albumArt: "/music/covers/teach-me-how-to-love.jpg",
  },
  {
    title: "Kimpton",
    artist: "Barry Can't Swim",
    src: "/music/songs/Kimpton.mp3",
    albumArt: "/music/covers/kimpton.png",
  },
  {
    title: "ModeratFrank(Sketch2)",
    artist: "Fred again..",
    src: "/music/songs/ModeratFrank(Sketch2).mp3",
    albumArt: "/music/covers/moderat-frank-sketch2.jpg",
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
  const playOnLoadRef = useRef(false);
  const trackLoadIdRef = useRef(0);

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

  const stopPlayback = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = null;
    setIsPlaying(false);
  }, []);

  const beginPlayback = useCallback(
    (a: HTMLAudioElement, loadId: number) => {
      void a.play()
        .then(() => {
          if (loadId !== trackLoadIdRef.current) return;
          setIsPlaying(true);
          animationRef.current = requestAnimationFrame(animate);
        })
        .catch(() => {
          if (loadId !== trackLoadIdRef.current) return;
          setIsPlaying(false);
        });
    },
    [animate],
  );

  const startPlayback = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    beginPlayback(a, trackLoadIdRef.current);
  }, [beginPlayback]);

  const skipTrack = useCallback((delta: -1 | 1) => {
    playOnLoadRef.current = true;
    setCurrentTrack((i) => (i + delta + tracks.length) % tracks.length);
  }, []);

  const togglePlay = () => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      setIsPlaying(false);
      skipTrack(1);
    };
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, [skipTrack]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const loadId = ++trackLoadIdRef.current;

    a.pause();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = null;
    a.load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset disc + playing UI on track change
    setRotation(0);

    const shouldPlay = playOnLoadRef.current;
    playOnLoadRef.current = false;
    if (!shouldPlay) {
      setIsPlaying(false);
      return;
    }

    const tryPlay = () => {
      if (loadId !== trackLoadIdRef.current) return;
      beginPlayback(a, loadId);
    };

    if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) tryPlay();
    else a.addEventListener("canplay", tryPlay, { once: true });

    return () => a.removeEventListener("canplay", tryPlay);
  }, [track.src, beginPlayback]);

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
              className="rounded-full p-1 transition-transform hover:scale-125"
              onClick={(e) => {
                e.stopPropagation();
                skipTrack(-1);
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
              className="rounded-full p-1 transition-transform hover:scale-125"
              onClick={(e) => {
                e.stopPropagation();
                skipTrack(1);
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
