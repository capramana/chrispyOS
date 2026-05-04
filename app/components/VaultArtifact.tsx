"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import VaultArtifactCard from "./VaultArtifactCard";

type VaultArtifactProps = {
  id: string;
  zIndex: number;
  registerNode: (id: string, el: HTMLDivElement | null) => void;
  onInteractionStart: (id: string) => void;
  onPositionChanged: () => void;
  src: string;
  alt: string;
  initialLeft: number;
  initialTop: number;
  maxWidth: number;
  maxHeight: number;
};

const TILT_MAX = 2;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;

export default function VaultArtifact({
  id,
  zIndex,
  registerNode,
  onInteractionStart,
  onPositionChanged,
  src,
  alt,
  initialLeft,
  initialTop,
  maxWidth,
  maxHeight,
}: VaultArtifactProps) {
  const [pos, setPos] = useState({ x: initialLeft, y: initialTop });
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
  const posRef = useRef({ x: initialLeft, y: initialTop });
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

        setTiltDeg(
          Math.max(-TILT_MAX, Math.min(TILT_MAX, gvx * 0.028)),
        );

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
        filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.12))",
        transform,
        transformOrigin: "center center",
        transition: motionActive ? "none" : "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <VaultArtifactCard
        src={src}
        alt={alt}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
      />
    </div>
  );
}
