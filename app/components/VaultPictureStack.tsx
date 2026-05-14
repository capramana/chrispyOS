"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type VaultPictureItem = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  captionYear?: string;
  captionUrl?: string;
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

/** Space around nominal card size for translate + rotation (symmetric about pile center) */
const PILE_MARGIN_PX = 54;

/** Mat padding on each side of the photo inside the white frame (total +2× per axis). */
const PICTURE_MAT_PADDING_PX = 4;

/** Corner radius on the photo (inner clip). */
const PICTURE_MAT_INNER_RADIUS_PX = 4;

/** Outer corner on the white frame (inner radius + mat padding for a smooth corner). */
const PICTURE_MAT_OUTER_RADIUS_PX =
  PICTURE_MAT_INNER_RADIUS_PX + PICTURE_MAT_PADDING_PX;

const PICTURE_MAT_OUTER_GROW_PX = 2 * PICTURE_MAT_PADDING_PX;

/** Outer white frame (collapsed + expanded). */
const PICTURE_MAT_OUTER_STYLE: CSSProperties = {
  boxSizing: "border-box",
  padding: PICTURE_MAT_PADDING_PX,
  backgroundColor: "#ffffff",
  lineHeight: 0,
  borderRadius: PICTURE_MAT_OUTER_RADIUS_PX,
};

/** Inner clip for photo corners (inside the mat padding). */
const PICTURE_MAT_INNER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: PICTURE_MAT_INNER_RADIUS_PX,
  overflow: "hidden",
  lineHeight: 0,
};

/** Visible pile indices and rotations (matches `Expandable Stacked Div Prototype.html`). */
const VIS = [0, 1, 2];
const ROTS = [4, -7, 11];
const GAP = 8;
const PAD = 10;

const CARD_TRANSITION =
  "transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), top 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), left 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), opacity 0.25s ease, box-shadow 0.25s ease";

/** Keep in sync with the `0.42s` motion in `CARD_TRANSITION` (collapse unmount delay). */
const CARD_TRANSITION_MS = 420;

function stackOuterSize(maxWidth: number, maxHeight: number) {
  return {
    effW: maxWidth,
    effH: maxHeight,
    innerW: maxWidth + 2 * PILE_MARGIN_PX + PICTURE_MAT_OUTER_GROW_PX,
    innerH: maxHeight + 2 * PILE_MARGIN_PX + PICTURE_MAT_OUTER_GROW_PX,
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

function outerCardSize(
  item: VaultPictureItem,
  maxWidth: number,
  maxHeight: number,
) {
  const iw = item.maxWidth ?? maxWidth;
  const ih = item.maxHeight ?? maxHeight;
  return { iw, ih, w: iw, h: ih };
}

function pictureDisplaySize(
  item: VaultPictureItem,
  maxWidth: number,
  maxHeight: number,
  naturalW: number,
  naturalH: number,
): { w: number; h: number } {
  const mw = item.maxWidth ?? maxWidth;
  const mh = item.maxHeight ?? maxHeight;
  if (naturalW <= 0 || naturalH <= 0) return { w: mw, h: mh };
  const s = Math.min(mw / naturalW, mh / naturalH, 1);
  return {
    w: Math.max(1, Math.round(naturalW * s)),
    h: Math.max(1, Math.round(naturalH * s)),
  };
}

function VaultPictureMatInner({
  item,
  maxWidth,
  maxHeight,
  reportStackOuter,
}: {
  item: VaultPictureItem;
  maxWidth: number;
  maxHeight: number;
  reportStackOuter: (itemId: string, w: number, h: number) => void;
}) {
  return (
    <div style={PICTURE_MAT_INNER_STYLE}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={item.alt}
        decoding="async"
        draggable={false}
        className="pointer-events-none block h-full w-full select-none object-contain"
        onLoad={(e) => {
          const el = e.currentTarget;
          const { w: rw, h: rh } = pictureDisplaySize(
            item,
            maxWidth,
            maxHeight,
            el.naturalWidth,
            el.naturalHeight,
          );
          reportStackOuter(
            item.id,
            rw + PICTURE_MAT_OUTER_GROW_PX,
            rh + PICTURE_MAT_OUTER_GROW_PX,
          );
        }}
      />
    </div>
  );
}

// ── Prototype (Expandable Stacked Div Prototype.html) ───────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return !(
    ax + aw + GAP <= bx ||
    bx + bw + GAP <= ax ||
    ay + ah + GAP <= by ||
    by + bh + GAP <= ay
  );
}

function inBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  sceneW: number,
  sceneH: number,
): boolean {
  return (
    x >= PAD &&
    y >= PAD &&
    x + w <= sceneW - PAD &&
    y + h <= sceneH - PAD
  );
}

type Size = { w: number; h: number };

/** Same algorithm as the HTML file: `computeLayout(ax, ay, sceneW, sceneH, sizes)` */
function computeLayout(
  ax: number,
  ay: number,
  sceneW: number,
  sceneH: number,
  sizes: Size[],
): { ci: number; sx: number; sy: number }[] {
  const placed: { ci: number; x: number; y: number; w: number; h: number }[] =
    [];

  const order = Array.from({ length: sizes.length }, (_, i) => i).sort(
    (a, b) => sizes[b]!.w * sizes[b]!.h - sizes[a]!.w * sizes[a]!.h,
  );

  for (let idx = 0; idx < order.length; idx++) {
    const ci = order[idx]!;
    const { w, h } = sizes[ci]!;

    let candidates: { x: number; y: number }[] = [];

    if (placed.length === 0) {
      const x = clamp(ax - w / 2, PAD, sceneW - PAD - w);
      const y = clamp(ay - h / 2, PAD, sceneH - PAD - h);
      candidates = [{ x, y }];
    } else {
      for (const p of placed) {
        candidates.push(
          { x: p.x + p.w + GAP, y: p.y },
          { x: p.x + p.w + GAP, y: p.y + p.h - h },
          { x: p.x - w - GAP, y: p.y },
          { x: p.x - w - GAP, y: p.y + p.h - h },
          { x: p.x, y: p.y + p.h + GAP },
          { x: p.x + p.w - w, y: p.y + p.h + GAP },
          { x: p.x, y: p.y - h - GAP },
          { x: p.x + p.w - w, y: p.y - h - GAP },
        );
      }
    }

    const valid = candidates.filter(
      (c) =>
        inBounds(c.x, c.y, w, h, sceneW, sceneH) &&
        !placed.some((p) =>
          overlaps(c.x, c.y, w, h, p.x, p.y, p.w, p.h),
        ),
    );

    if (valid.length === 0) continue;

    valid.sort(
      (a, b) =>
        Math.hypot(a.x + w / 2 - ax, a.y + h / 2 - ay) -
        Math.hypot(b.x + w / 2 - ax, b.y + h / 2 - ay),
    );

    const best = valid[0]!;
    placed.push({ ci, x: best.x, y: best.y, w, h });
  }

  return placed.map(({ ci, x, y }) => ({ ci, sx: x, sy: y }));
}

// ── Drag / glide (unchanged behavior for the draggable shell) ───────────────

const TILT_MAX = 2;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;

const TAP_MOVE_THRESHOLD_PX = 10;

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
  /** Prototype: `stacked` vs `expanded` */
  const [expanded, setExpanded] = useState(false);
  /**
   * When expanded: false = portal cards sit on the stack anchor (so the next paint can
   * move them to the cluster and CSS will interpolate). True = cluster positions from
   * `computeLayout`. Same elements as the HTML prototype; avoids mounting at final coords.
   */
  const [expandSpread, setExpandSpread] = useState(false);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1200, h: 800 },
  );

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
  const collapseCloseTimeoutRef = useRef<number | null>(null);

  const [stackOuterById, setStackOuterById] = useState<
    Record<string, { w: number; h: number }>
  >({});

  const reportStackOuter = useCallback((itemId: string, w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    setStackOuterById((prev) => {
      const cur = prev[itemId];
      if (cur && cur.w === w && cur.h === h) return prev;
      return { ...prev, [itemId]: { w, h } };
    });
  }, []);

  const sizes = useMemo(
    () =>
      items.map((it) => {
        const m = stackOuterById[it.id];
        if (m) return { w: m.w, h: m.h };
        const o = outerCardSize(it, maxWidth, maxHeight);
        return {
          w: o.w + PICTURE_MAT_OUTER_GROW_PX,
          h: o.h + PICTURE_MAT_OUTER_GROW_PX,
        };
      }),
    [items, maxWidth, maxHeight, stackOuterById],
  );

  const layoutSlots = useMemo(() => {
    if (!expanded || items.length === 0) return [];
    const { innerW, innerH } = stackOuterSize(maxWidth, maxHeight);
    const ax = pos.x + innerW / 2;
    const ay = pos.y + innerH / 2;
    return computeLayout(ax, ay, viewport.w, viewport.h, sizes);
  }, [
    expanded,
    items.length,
    pos.x,
    pos.y,
    viewport.w,
    viewport.h,
    sizes,
    maxWidth,
    maxHeight,
  ]);

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

  /** After open: paint stack pose, then next frame flip to cluster (prototype `init` timing). */
  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (alive) setExpandSpread(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id1);
    };
  }, [expanded]);

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

  const expandStack = useCallback(() => {
    if (collapseCloseTimeoutRef.current != null) {
      clearTimeout(collapseCloseTimeoutRef.current);
      collapseCloseTimeoutRef.current = null;
    }
    setExpandSpread(false);
    setExpanded(true);
  }, []);

  const collapseStack = useCallback(() => {
    if (collapseCloseTimeoutRef.current != null) {
      clearTimeout(collapseCloseTimeoutRef.current);
      collapseCloseTimeoutRef.current = null;
    }
    setExpandSpread(false);
    collapseCloseTimeoutRef.current = window.setTimeout(() => {
      collapseCloseTimeoutRef.current = null;
      setExpanded(false);
    }, CARD_TRANSITION_MS);
  }, []);

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
        expandStack();
        notifyPos.current();
        return;
      }
      startGlide(vx, vy);
      notifyPos.current();
    },
    [expanded, expandStack, startGlide],
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

  useEffect(() => {
    if (!expanded) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") collapseStack();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, collapseStack]);

  useEffect(
    () => () => {
      if (collapseCloseTimeoutRef.current != null) {
        clearTimeout(collapseCloseTimeoutRef.current);
        collapseCloseTimeoutRef.current = null;
      }
    },
    [],
  );

  const motionActive = dragging || gliding;
  const transform = `rotate(${tiltDeg.toFixed(2)}deg) scale(${dragging ? 1.02 : 1})`;

  const { innerW, innerH } = stackOuterSize(maxWidth, maxHeight);
  const { ax, ay } = {
    ax: pos.x + innerW / 2,
    ay: pos.y + innerH / 2,
  };

  return (
    <>
      <div
        ref={setRootRef}
        className="vault-artifact touch-none select-none outline-none focus:outline-none"
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          display: expanded ? "none" : "inline-block",
          lineHeight: 0,
          zIndex,
          cursor: dragging ? "grabbing" : "grab",
          filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.08))",
          transform,
          transformOrigin: "center center",
          pointerEvents: expanded ? "none" : "auto",
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
          {items.map((item, i) => {
            const { w, h } = sizes[i]!;
            const vp = VIS.indexOf(i);
            const isVis = vp !== -1;
            return (
              <Fragment key={item.id}>
                <div
                  className="absolute block select-none"
                  style={{
                    ...PICTURE_MAT_OUTER_STYLE,
                    left: ax - pos.x - w / 2,
                    top: ay - pos.y - h / 2,
                    width: w,
                    height: h,
                    zIndex: isVis ? 10 + vp : 5,
                    opacity: isVis ? 1 : 0,
                    pointerEvents: isVis ? "auto" : "none",
                    transform: isVis
                      ? `rotate(${ROTS[vp]}deg)`
                      : "rotate(0deg) scale(0.88)",
                    boxShadow: isVis
                      ? `0 ${2 + vp * 2}px ${8 + vp * 4}px rgba(0,0,0,0.32)`
                      : "none",
                    transition: CARD_TRANSITION,
                  }}
                >
                  <VaultPictureMatInner
                    item={item}
                    maxWidth={maxWidth}
                    maxHeight={maxHeight}
                    reportStackOuter={reportStackOuter}
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {expanded
        ? createPortal(
            <div
              className="fixed inset-0 touch-none"
              style={{ zIndex: Math.max(zIndex, 70) }}
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default appearance-none border-0 p-0 outline-none focus:outline-none"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--background) 10%, transparent)",
                  WebkitBackdropFilter: "blur(2px)",
                  backdropFilter: "blur(2px)",
                }}
                aria-label="Close picture gallery"
                onClick={collapseStack}
              />
              {items.map((item, i) => {
                const { w, h } = sizes[i]!;
                const slotIdx = layoutSlots.findIndex((s) => s.ci === i);
                const slot = slotIdx !== -1 ? layoutSlots[slotIdx]! : null;
                const vp = VIS.indexOf(i);
                const isVis = vp !== -1;

                const useClusterPose = expandSpread && slot != null;
                const stackLeft = ax - w / 2;
                const stackTop = ay - h / 2;
                const left = useClusterPose ? slot.sx : stackLeft;
                const top = useClusterPose ? slot.sy : stackTop;

                const transform = useClusterPose
                  ? "rotate(0deg)"
                  : isVis
                    ? `rotate(${ROTS[vp]}deg)`
                    : "rotate(0deg) scale(0.88)";
                const opacity = useClusterPose ? 1 : isVis ? 1 : 0;
                const boxShadow = useClusterPose
                  ? "0 4px 18px rgba(0,0,0,0.24)"
                  : isVis
                    ? `0 ${2 + vp * 2}px ${8 + vp * 4}px rgba(0,0,0,0.32)`
                    : "none";
                const zPortal =
                  useClusterPose && slotIdx >= 0
                    ? 200 + slotIdx
                    : isVis
                      ? 10 + vp
                      : 5;

                return (
                  <Fragment key={item.id}>
                    <div
                      className="fixed cursor-pointer select-none"
                      style={{
                        ...PICTURE_MAT_OUTER_STYLE,
                        left,
                        top,
                        width: w,
                        height: h,
                        zIndex: zPortal,
                        opacity,
                        transform,
                        boxShadow,
                        transition: CARD_TRANSITION,
                        pointerEvents: useClusterPose
                          ? "auto"
                          : isVis
                            ? "auto"
                            : "none",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <VaultPictureMatInner
                        item={item}
                        maxWidth={maxWidth}
                        maxHeight={maxHeight}
                        reportStackOuter={reportStackOuter}
                      />
                    </div>
                  </Fragment>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
