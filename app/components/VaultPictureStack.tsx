"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { LayoutGroup, motion } from "framer-motion";
import VaultArtifactCard, {
  VAULT_STACKED_MAT_PADDING_PX,
} from "./VaultArtifactCard";

export type VaultPictureItem = {
  id: string;
  src: string;
  alt: string;
  /** Passed into `VaultArtifactCard` on zoom (footer under the image). */
  caption?: string;
  captionYear?: string;
  captionUrl?: string;
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

/** Collapsed vault shows this many cards; expand uses full `items` in a grid */
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

const TAP_MOVE_THRESHOLD_PX = 10;
const OVERLAY_TRANSITION_MS = 320;
/** Same idea as Cambio’s `Trigger`: lift the active tile above grid siblings during shared zoom. */
const VAULT_FOCUS_CELL_LIFT_Z = 1000;

/** Cambio-style: shared `layoutId` + backdrop tween use the same timing so dim tracks the morph. */
const VAULT_MORPH_DURATION_S = 0.48;
const VAULT_MORPH_MS = Math.round(VAULT_MORPH_DURATION_S * 1000);
const VAULT_MORPH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const vaultMorphTransition = {
  type: "tween" as const,
  duration: VAULT_MORPH_DURATION_S,
  ease: VAULT_MORPH_EASE,
};

function vaultLayoutId(stackId: string, assetId: string) {
  return `vault-${stackId}-art-${assetId}`;
}

/** Up to `maxScale`× thumb slot, clamped to fit most of the viewport (padding in px). */
function vaultFocusZoomSize(
  baseW: number,
  baseH: number,
  vpW: number,
  vpH: number,
  maxScale: number,
  padPx: number,
) {
  const capW = Math.max(80, vpW * 0.94 - padPx);
  const capH = Math.max(80, vpH * 0.92 - padPx);
  const scale = Math.min(maxScale, capW / baseW, capH / baseH);
  return {
    zoomW: Math.round(baseW * scale),
    zoomH: Math.round(baseH * scale),
  };
}

/** Portalled zoom (Framer Motion shared `layoutId`; no dimming scrim — grid handles focus contrast). */
function VaultOverlayPortal({
  stackId,
  focusAssetId,
  items,
  maxWidth,
  maxHeight,
  viewport,
}: {
  stackId: string;
  focusAssetId: string | null;
  items: VaultPictureItem[];
  maxWidth: number;
  maxHeight: number;
  viewport: { w: number; h: number };
}) {
  const item =
    focusAssetId != null
      ? (items.find((x) => x.id === focusAssetId) ?? null)
      : null;
  let zoomW = maxWidth;
  let zoomH = maxHeight;
  if (item) {
    const baseW = item.maxWidth ?? maxWidth;
    const baseH = item.maxHeight ?? maxHeight;
    const portrait = baseH > baseW;
    const maxScale = portrait ? 4.5 : 6;
    const z = vaultFocusZoomSize(
      baseW,
      baseH,
      viewport.w,
      viewport.h,
      maxScale,
      48,
    );
    zoomW = z.zoomW;
    zoomH = z.zoomH;
  }

  return (
    <div
      className="pointer-events-none fixed top-0 bottom-0 left-[max(-5rem,calc(-10vw-12px))] right-[max(-5rem,calc(-10vw-12px))] isolate"
      style={{ zIndex: 200_000 }}
    >
      {item != null ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div
            className="pointer-events-auto relative z-10 shrink-0 touch-auto overflow-visible"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <motion.span
              layoutId={vaultLayoutId(stackId, item.id)}
              className="inline-block overflow-visible"
              transition={vaultMorphTransition}
            >
              <VaultArtifactCard
                variant="stacked"
                clampToParent={false}
                layerShadow="0 14px 36px rgba(0,0,0,0.18)"
                src={item.src}
                alt={item.alt}
                maxWidth={zoomW}
                maxHeight={zoomH}
                caption={item.caption}
                captionYear={item.captionYear}
                captionUrl={item.captionUrl}
              />
            </motion.span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayEntered, setOverlayEntered] = useState(false);
  const [focusAssetId, setFocusAssetId] = useState<string | null>(null);
  /** Lift target on pointer-down so the first layout frame isn’t under later grid items. */
  const [liftAssetId, setLiftAssetId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1200, h: 800 },
  );
  /** Cleared after `VAULT_MORPH_MS` once focus ends so the morphing tile stays above siblings. */
  const liftClearTimeoutRef = useRef<number | null>(null);
  const cancelLiftClearTimeout = useCallback(() => {
    if (liftClearTimeoutRef.current != null) {
      clearTimeout(liftClearTimeoutRef.current);
      liftClearTimeoutRef.current = null;
    }
  }, []);
  const dismissVaultFocus = useCallback(
    (exitingAssetId: string) => {
      cancelLiftClearTimeout();
      setLiftAssetId(exitingAssetId);
      setFocusAssetId(null);
      liftClearTimeoutRef.current = window.setTimeout(() => {
        liftClearTimeoutRef.current = null;
        setLiftAssetId(null);
      }, VAULT_MORPH_MS);
    },
    [cancelLiftClearTimeout],
  );
  useEffect(() => () => cancelLiftClearTimeout(), [cancelLiftClearTimeout]);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const dragCommittedRef = useRef(false);
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

  const openOverlay = useCallback(() => {
    setLiftAssetId(null);
    setFocusAssetId(null);
    setExpanded(true);
    setOverlayMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOverlayEntered(true));
    });
  }, []);

  useLayoutEffect(() => {
    notifyPos.current = onPositionChanged;
  }, [onPositionChanged]);

  useLayoutEffect(() => {
    const sync = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

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
      if (expanded) return;
      const el = elRef.current;
      if (!el) return;
      cancelGlide();
      const rect = el.getBoundingClientRect();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      sizeRef.current = { w: rect.width, h: rect.height };
      dragCommittedRef.current = false;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
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
    [cancelGlide, expanded, id, onInteractionStart],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (
        Math.hypot(
          e.clientX - pointerStartRef.current.x,
          e.clientY - pointerStartRef.current.y,
        ) >= TAP_MOVE_THRESHOLD_PX
      ) {
        dragCommittedRef.current = true;
      }
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
      const wasTap = !dragCommittedRef.current;
      dragRef.current = null;
      setDragging(false);
      try {
        elRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (wasTap && !expanded) {
        openOverlay();
        notifyPos.current();
        return;
      }
      startGlide(vx, vy);
      notifyPos.current();
    },
    [expanded, openOverlay, startGlide],
  );

  useEffect(() => () => cancelGlide(), [cancelGlide]);

  useEffect(() => {
    if (expanded) return;
    if (!overlayMounted) return;
    const tEnter = window.setTimeout(() => {
      setOverlayEntered(false);
    }, 0);
    const tUnmount = window.setTimeout(() => {
      setLiftAssetId(null);
      setOverlayMounted(false);
    }, OVERLAY_TRANSITION_MS);
    return () => {
      clearTimeout(tEnter);
      clearTimeout(tUnmount);
    };
  }, [expanded, overlayMounted]);

  useEffect(() => {
    if (!overlayMounted) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (focusAssetId) {
        dismissVaultFocus(focusAssetId);
      } else {
        cancelLiftClearTimeout();
        setLiftAssetId(null);
        setFocusAssetId(null);
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [
    overlayMounted,
    focusAssetId,
    dismissVaultFocus,
    cancelLiftClearTimeout,
  ]);

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
    <LayoutGroup id={id}>
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
          cursor: overlayMounted ? "default" : dragging ? "grabbing" : "grab",
          filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.08))",
          transform,
          transformOrigin: "center center",
          pointerEvents: overlayMounted ? "none" : "auto",
          opacity: overlayMounted ? 0 : 1,
          transition: motionActive
            ? "none"
            : "opacity 0.3s ease, transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
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
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Shell wider than 100vw: `overflow-y-auto` implies horizontal clip; bleed room stops edge thumbnails clipping during layoutId morph. */}
      {overlayMounted ? (
        <div
          className={`fixed top-0 bottom-0 touch-none overflow-y-auto left-[max(-5rem,calc(-10vw-12px))] right-[max(-5rem,calc(-10vw-12px))] ${
            focusAssetId != null || liftAssetId != null
              ? "z-[500]"
              : "z-[70]"
          }`}
        >
          <button
            type="button"
            className={`absolute inset-0 z-[1] block cursor-default appearance-none border-0 p-0 outline-none transition-opacity ease-out focus:outline-none ${
              overlayEntered ? "opacity-100" : "opacity-0"
            }`}
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--background) 88%, transparent)",
              transitionDuration: `${OVERLAY_TRANSITION_MS}ms`,
            }}
            aria-label="Close picture gallery"
            onPointerDown={() => {
              if (focusAssetId != null) {
                dismissVaultFocus(focusAssetId);
              } else {
                cancelLiftClearTimeout();
                setLiftAssetId(null);
                setExpanded(false);
              }
            }}
          />
          <div
            className={`relative z-[1] flex min-h-full w-full items-center justify-center overflow-x-visible p-6 ease-out pointer-events-none ${
              focusAssetId != null
                ? "translate-y-0 opacity-100 transition-opacity"
                : `transition-[opacity,transform] ${
                    overlayEntered
                      ? "translate-y-0 opacity-100"
                      : "translate-y-3 opacity-0"
                  }`
            }`}
            style={{ transitionDuration: `${OVERLAY_TRANSITION_MS}ms` }}
            role="dialog"
            aria-modal="true"
            aria-label="All pictures"
          >
            <div className="pointer-events-none grid w-full max-w-[min(96vw,880px)] justify-items-center gap-6 overflow-x-visible [grid-template-columns:repeat(auto-fill,minmax(148px,1fr))] sm:gap-8">
              {items.map((item) => {
                const isFocused = focusAssetId === item.id;
                const zoomActive = focusAssetId != null;
                const cellLifted =
                  liftAssetId === item.id ||
                  (focusAssetId != null && focusAssetId === item.id);
                /** Same flex box in gallery + zoom so the grid does not reflow when focus toggles. */
                const cellLayout =
                  "flex w-full min-w-0 flex-col items-center justify-center overflow-visible";
                const cellClass = zoomActive
                  ? `${cellLayout} ${
                      isFocused ? "pointer-events-none" : "pointer-events-auto"
                    } transition-opacity ease-out [transition-duration:480ms] ${
                      isFocused ? "opacity-100" : "opacity-[0.32]"
                    }`
                  : `${cellLayout} pointer-events-auto transition-[opacity,transform] ease-out ${
                      overlayEntered
                        ? "translate-y-0 opacity-100"
                        : "translate-y-2 opacity-0"
                    }`;
                let cellStyle: CSSProperties;
                if (zoomActive) {
                  cellStyle = {
                    position: "relative",
                    zIndex: cellLifted ? VAULT_FOCUS_CELL_LIFT_Z : 0,
                    transform: "none",
                  };
                } else if (cellLifted) {
                  cellStyle = {
                    position: "relative",
                    zIndex: VAULT_FOCUS_CELL_LIFT_Z,
                    transform: "none",
                    transitionDuration: `${OVERLAY_TRANSITION_MS}ms`,
                  };
                } else {
                  cellStyle = {
                    transitionDuration: `${OVERLAY_TRANSITION_MS}ms`,
                  };
                }
                const thumbW = item.maxWidth ?? maxWidth;
                const thumbH = item.maxHeight ?? maxHeight;
                const gridCard = (
                  <VaultArtifactCard
                    variant="stacked"
                    layerShadow="0 10px 24px rgba(0,0,0,0.12)"
                    src={item.src}
                    alt={item.alt}
                    maxWidth={thumbW}
                    maxHeight={thumbH}
                  />
                );
                return (
                  <div key={item.id} className={cellClass} style={cellStyle}>
                    {isFocused ? (
                      <div
                        className="invisible inline-block border-0 p-0 leading-[0] outline-none"
                        aria-hidden
                      >
                        {gridCard}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-block cursor-pointer border-0 bg-transparent p-0 leading-[0] outline-none focus-visible:opacity-90"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          setLiftAssetId(item.id);
                        }}
                        onClick={() => {
                          if (focusAssetId != null) {
                            if (focusAssetId !== item.id) {
                              dismissVaultFocus(focusAssetId);
                            }
                            return;
                          }
                          cancelLiftClearTimeout();
                          setLiftAssetId(null);
                          setFocusAssetId(item.id);
                        }}
                      >
                        <motion.span
                          layoutId={vaultLayoutId(id, item.id)}
                          className="inline-block overflow-visible"
                          transition={vaultMorphTransition}
                        >
                          {gridCard}
                        </motion.span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {overlayMounted
        ? createPortal(
            <VaultOverlayPortal
              stackId={id}
              focusAssetId={focusAssetId}
              items={items}
              maxWidth={maxWidth}
              maxHeight={maxHeight}
              viewport={viewport}
            />,
            document.body,
          )
        : null}
    </LayoutGroup>
  );
}
