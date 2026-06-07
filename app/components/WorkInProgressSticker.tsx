"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { boxFromTopLeft, registerSpawnPeer } from "./uiPlacement";
import { pickWidgetPosition } from "./vaultPlacement";
import {
  reclampWidgetPosition,
  wipStickerBounds,
} from "./vaultRects";
import "./WorkInProgressSticker.css";

const SPAWN_PEER_ID = "wip-sticker";

export default function WorkInProgressSticker() {
  const stickerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const rotationSetRef = useRef(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!pos || rotationSetRef.current) return;
    const el = stickerRef.current;
    if (!el) return;
    rotationSetRef.current = true;
    const end = -(Math.random() * 5 + 10);
    const start = end - 10;
    el.style.setProperty("--wip-rot-start", `${start}deg`);
    el.style.setProperty("--wip-rot-end", `${end}deg`);
  }, [pos]);

  useLayoutEffect(() => {
    const unregister = registerSpawnPeer(SPAWN_PEER_ID, () => {
      const p = posRef.current;
      if (!p) return null;
      const { w, h } = wipStickerBounds();
      return boxFromTopLeft(p.x, p.y, w, h);
    });

    const sync = () => {
      const { w, h } = wipStickerBounds();
      setPos((prev) => {
        if (!prev) {
          const [x, y] = pickWidgetPosition(w, h, SPAWN_PEER_ID);
          const next = { x, y };
          posRef.current = next;
          return next;
        }
        const [x, y] = reclampWidgetPosition(prev.x, prev.y, w, h);
        if (x === prev.x && y === prev.y) return prev;
        const next = { x, y };
        posRef.current = next;
        return next;
      });
    };
    sync();
    window.addEventListener("resize", sync);
    return () => {
      unregister();
      window.removeEventListener("resize", sync);
    };
  }, []);

  if (!pos) return null;

  return (
    <div
      className="wip-sticker-root"
      style={{ left: pos.x, top: pos.y }}
      aria-hidden
    >
      <svg className="wip-sticker-filter-def" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <filter
            id="wip-sticker-light"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology in="SourceAlpha" result="dilate" operator="dilate" radius="2" />
            <feFlood floodColor="#fafafa" result="outlinecolor" />
            <feTurbulence baseFrequency="0.03" seed="120" numOctaves={4} type="turbulence" result="turb" />
            <feComposite in="turb" in2="dilate" operator="in" result="outline" />
            <feComposite in="outlinecolor" in2="dilate" operator="in" result="outlineflat" />
            <feMerge result="merged">
              <feMergeNode in="outlineflat" />
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
            <feDropShadow
              in="merged"
              dx="1"
              dy="3"
              stdDeviation="3"
              floodColor="hsl(0,0%,0%)"
              floodOpacity="0.75"
            />
          </filter>
        </defs>
      </svg>
      <div ref={stickerRef} className="wip-sticker-wrap" />
    </div>
  );
}
