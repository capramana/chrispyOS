"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import VaultArtifactCard, {
  VAULT_STACKED_MAT_PADDING_PX,
} from "./VaultArtifactCard";

export type VaultPictureItem = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  /** Override stack defaults for this print only (px, same semantics as `maxWidth` / `maxHeight` on the stack). */
  maxWidth?: number;
  maxHeight?: number;
};

type VaultPictureStackProps = {
  id: string;
  zIndex: number;
  registerNode: (id: string, el: HTMLDivElement | null) => void;
  onInteractionStart: (id: string) => void;
  onPositionChanged: () => void;
  items: VaultPictureItem[];
  initialLeft: number;
  initialTop: number;
  maxWidth: number;
  maxHeight: number;
};

/** Collapsed vault shows this many cards; full list is still in `items` for expand later */
const PREVIEW_CARD_COUNT = 3;
/** Space around nominal card size for translate + rotation (symmetric about pile center) */
const PILE_MARGIN_PX = 54;

function stackOuterSize(maxWidth: number, maxHeight: number) {
  const matTotal = VAULT_STACKED_MAT_PADDING_PX * 2;
  const effW = maxWidth + matTotal;
  const effH = maxHeight + matTotal;
  return {
    effW,
    effH,
    innerW: effW + 2 * PILE_MARGIN_PX,
    innerH: effH + 2 * PILE_MARGIN_PX,
  };
}

/** `initialLeft` / `initialTop` are the pile center in viewport px (not top-left of the widget). */
function posForAnchorCenter(
  initialLeft: number,
  initialTop: number,
  maxWidth: number,
  maxHeight: number,
) {
  const { innerW, innerH } = stackOuterSize(maxWidth, maxHeight);
  return { x: initialLeft - innerW / 2, y: initialTop - innerH / 2 };
}

type CardMess = {
  rotDeg: number;
};

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function u01(h: number, salt: number): number {
  const x = (h ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  return x / 2 ** 32;
}

/** One XY offset for the whole pile so every card shares the same “desk” position. */
function pileSharedOffset(stackKey: string): { sx: number; sy: number } {
  const h = fnv1a(stackKey);
  const span = 10;
  return {
    sx: -span / 2 + u01(h, 1) * span,
    sy: -span / 2 + u01(h, 2) * span,
  };
}

/** Tiny per-layer shift so corners still peek — stays tight around the shared center. */
function pileLayerNudge(stackKey: string, fromTop: number): { dx: number; dy: number } {
  const h = fnv1a(`${stackKey}#${fromTop}`);
  const span = 6;
  return {
    dx: -span / 2 + u01(h, 0) * span,
    dy: -span / 2 + u01(h, 1) * span,
  };
}

/**
 * Deterministic rotation (stable across SSR / hydration).
 * `fromTop === 0` is the front/top card — smallest tilt; deeper cards tilt more.
 */
function stableCardMess(
  seed: string,
  fromTop: number,
  totalLayers: number,
): CardMess {
  const h = fnv1a(seed);
  const u = (salt: number) => u01(h, salt);
  const sign = fromTop % 2 === 0 ? 1 : -1;
  let rotDeg: number;
  if (fromTop === 0 || totalLayers <= 1) {
    rotDeg = (u(5) - 0.5) * 5;
  } else {
    const span = fromTop / (totalLayers - 1);
    const rotMag = 5 + span * 10 + u(0) * 4;
    rotDeg = sign * rotMag;
  }
  return { rotDeg };
}

function layerBoxShadow(layerIndex: number, totalLayers: number): string {
  if (totalLayers <= 1) {
    return "0 6px 16px rgba(0,0,0,0.10)";
  }
  const t = layerIndex / (totalLayers - 1);
  const y = 4 + t * 9;
  const blur = 10 + t * 16;
  const alpha = 0.07 + t * 0.09;
  return `0 ${y.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${alpha.toFixed(3)})`;
}

const TILT_MAX = 2;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;

export default function VaultPictureStack({
  id,
  zIndex,
  registerNode,
  onInteractionStart,
  onPositionChanged,
  items,
  initialLeft,
  initialTop,
  maxWidth,
  maxHeight,
}: VaultPictureStackProps) {
  const [pos, setPos] = useState(() =>
    posForAnchorCenter(initialLeft, initialTop, maxWidth, maxHeight),
  );
  const [tiltDeg, setTiltDeg] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const glideRafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(
    posForAnchorCenter(initialLeft, initialTop, maxWidth, maxHeight),
  );
  const notifyPos = useRef(onPositionChanged);

  useLayoutEffect(() => {
    notifyPos.current = onPositionChanged;
  }, [onPositionChanged]);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      elRef.current = node;
      registerNode(id, node);
    },
    [id, registerNode],
  );

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const cancelGlide = useCallback(() => {
    if (glideRafRef.current !== null) {
      cancelAnimationFrame(glideRafRef.current);
      glideRafRef.current = null;
    }
    setGliding(false);
  }, []);

  const clamp = useCallback((x: number, y: number, w: number, h: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    return {
      x: Math.min(Math.max(margin, x), Math.max(margin, vw - w - margin)),
      y: Math.min(Math.max(margin, y), Math.max(margin, vh - h - margin)),
    };
  }, []);

  const startGlide = useCallback(
    (vx: number, vy: number) => {
      if (Math.hypot(vx, vy) < GLIDE_SPEED_MIN) {
        setTiltDeg(0);
        return;
      }

      cancelGlide();
      setGliding(true);

      let gvx = vx * GLIDE_VELOCITY_SCALE;
      let gvy = vy * GLIDE_VELOCITY_SCALE;
      const capMag = Math.hypot(gvx, gvy);
      if (capMag > GLIDE_VELOCITY_CAP && capMag > 0) {
        const s = GLIDE_VELOCITY_CAP / capMag;
        gvx *= s;
        gvy *= s;
      }
      let last = performance.now();

      const tick = (now: number) => {
        const dtMs = Math.min(48, now - last);
        last = now;
        const { w, h } = sizeRef.current;
        if (w <= 0 || h <= 0) {
          glideRafRef.current = null;
          setGliding(false);
          setTiltDeg(0);
          return;
        }

        const friction = Math.exp(-FRICTION_PER_MS * dtMs);
        const p = posRef.current;
        const nx = p.x + gvx * dtMs;
        const ny = p.y + gvy * dtMs;
        const c = clamp(nx, ny, w, h);
        if (c.x !== nx) gvx = 0;
        if (c.y !== ny) gvy = 0;
        gvx *= friction;
        gvy *= friction;
        posRef.current = c;
        setPos(c);
        notifyPos.current();

        setTiltDeg(Math.max(-TILT_MAX, Math.min(TILT_MAX, gvx * 0.028)));

        if (Math.hypot(gvx, gvy) < GLIDE_STOP) {
          glideRafRef.current = null;
          setGliding(false);
          setTiltDeg(0);
          notifyPos.current();
          return;
        }

        glideRafRef.current = requestAnimationFrame(tick);
      };

      glideRafRef.current = requestAnimationFrame(tick);
    },
    [cancelGlide, clamp],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = elRef.current;
      if (!el) return;
      cancelGlide();
      const rect = el.getBoundingClientRect();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      sizeRef.current = { w: rect.width, h: rect.height };
      dragRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      velocityRef.current = { vx: 0, vy: 0 };
      const t = performance.now();
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: t };
      setDragging(true);
      setTiltDeg(0);
      onInteractionStart(id);
    },
    [cancelGlide, id, onInteractionStart],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const now = performance.now();
      const dtMs = now - lastPointerRef.current.time;
      if (dtMs > 0) {
        const instVx = (e.clientX - lastPointerRef.current.x) / dtMs;
        const instVy = (e.clientY - lastPointerRef.current.y) / dtMs;
        velocityRef.current = {
          vx: velocityRef.current.vx * 0.72 + instVx * 0.28,
          vy: velocityRef.current.vy * 0.72 + instVy * 0.28,
        };
        lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };
      }

      const nx = e.clientX - d.offsetX;
      const ny = e.clientY - d.offsetY;
      const c = clamp(nx, ny, d.width, d.height);
      posRef.current = c;
      setPos((p) => (c.x !== p.x || c.y !== p.y ? c : p));
      notifyPos.current();

      setTiltDeg(
        Math.max(
          -TILT_MAX,
          Math.min(TILT_MAX, velocityRef.current.vx * 0.042),
        ),
      );
    },
    [clamp],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { vx, vy } = velocityRef.current;
      dragRef.current = null;
      setDragging(false);
      try {
        elRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      startGlide(vx, vy);
      notifyPos.current();
    },
    [startGlide],
  );

  useEffect(() => () => cancelGlide(), [cancelGlide]);

  useEffect(() => {
    const onResize = () => {
      const el = elRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      setPos((p) => {
        const c = clamp(p.x, p.y, rect.width, rect.height);
        posRef.current = c;
        return c;
      });
      notifyPos.current();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const motionActive = dragging || gliding;
  const transform = `rotate(${tiltDeg.toFixed(2)}deg) scale(${dragging ? 1.02 : 1})`;

  const previewItems =
    items.length <= PREVIEW_CARD_COUNT
      ? items
      : items.slice(-PREVIEW_CARD_COUNT);

  const { innerW, innerH } = stackOuterSize(maxWidth, maxHeight);
  const totalLayers = previewItems.length;
  const pileKey = `${id}:${previewItems.map((p) => p.id).join(",")}`;
  const shared = pileSharedOffset(pileKey);

  return (
    <div
      ref={setRootRef}
      className="vault-artifact touch-none select-none outline-none focus:outline-none"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        display: "inline-block",
        lineHeight: 0,
        zIndex,
        cursor: dragging ? "grabbing" : "grab",
        filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.08))",
        transform,
        transformOrigin: "center center",
        transition: motionActive
          ? "none"
          : "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        className="relative isolate overflow-visible"
        style={{
          width: innerW,
          height: innerH,
        }}
      >
        {previewItems.map((item, i) => {
          const fromTop = previewItems.length - 1 - i;
          const m = stableCardMess(item.id, fromTop, previewItems.length);
          const nudge = pileLayerNudge(pileKey, fromTop);
          return (
            <div
              key={item.id}
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                zIndex: i + 1,
                transform: `translate(calc(-50% + ${shared.sx + nudge.dx}px), calc(-50% + ${shared.sy + nudge.dy}px)) rotate(${m.rotDeg.toFixed(2)}deg)`,
                transformOrigin: "center center",
              }}
            >
              <VaultArtifactCard
                variant="stacked"
                layerShadow={layerBoxShadow(i, totalLayers)}
                src={item.src}
                alt={item.alt}
                maxWidth={item.maxWidth ?? maxWidth}
                maxHeight={item.maxHeight ?? maxHeight}
                caption={item.caption}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
