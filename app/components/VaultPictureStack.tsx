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
import { createPortal, flushSync } from "react-dom";
import { clampVaultPosition, VAULT_PILE_MARGIN_PX } from "./vaultRects";
import { ArrowUpRight } from "iconoir-react";

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
const PICTURE_MAT_PADDING_PX = 4;

/** Corner radius on the photo (inner clip). */
const PICTURE_MAT_INNER_RADIUS_PX = 4;

/** Outer corner on the white frame (inner radius + mat padding for a smooth corner). */
const PICTURE_MAT_OUTER_RADIUS_PX =
  PICTURE_MAT_INNER_RADIUS_PX + PICTURE_MAT_PADDING_PX;

const PICTURE_MAT_OUTER_GROW_PX = 2 * PICTURE_MAT_PADDING_PX;

/** Vault picture mat outer (`--vault-picture-mat-*` in `globals.css`). */
const PICTURE_MAT_OUTER_STYLE: CSSProperties = {
  boxSizing: "border-box",
  padding: `${PICTURE_MAT_PADDING_PX}px`,
  background: "var(--vault-picture-mat-bg)",
  border: "var(--vault-picture-mat-border)",
  lineHeight: 0,
  borderRadius: `${PICTURE_MAT_OUTER_RADIUS_PX}px`,
};

/** Inner clip for photo corners (inside the mat padding). */
const PICTURE_MAT_INNER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: `${PICTURE_MAT_INNER_RADIUS_PX}px`,
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

const OVERLAY_BACKDROP_TRANSITION =
  "opacity 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), backdrop-filter 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), -webkit-backdrop-filter 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)";

const ZOOM_GRID_LIFT_Z = 6000;
const ZOOM_MODAL_Z = 6200;

/** Close VT only — `globals.css` shortens `::view-transition-group(.vault-cambio)`. */
const VAULT_PICTURE_VT_EXIT_CLASS = "vault-picture-vt-exit";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    skipTransition: () => void;
  };
};

function vaultPictureVtName(itemId: string) {
  return `vault-pic-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

type ViewTransitionCss = CSSProperties & {
  viewTransitionName?: string;
  viewTransitionClass?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getDocumentViewTransition(): DocumentWithViewTransition | undefined {
  if (typeof document === "undefined") return undefined;
  return document as DocumentWithViewTransition;
}

function zoomOuterDisplaySize(
  outerW: number,
  outerH: number,
  vw: number,
  vh: number,
): { w: number; h: number } {
  const pad = 48;
  const innerW = Math.max(1, outerW - PICTURE_MAT_OUTER_GROW_PX);
  const innerH = Math.max(1, outerH - PICTURE_MAT_OUTER_GROW_PX);
  const capInnerW = Math.max(80, vw - pad * 2 - PICTURE_MAT_OUTER_GROW_PX);
  const capInnerH = Math.max(80, vh - pad * 2 - PICTURE_MAT_OUTER_GROW_PX);
  const s = Math.min(capInnerW / innerW, capInnerH / innerH, 3);
  const newInnerW = Math.max(1, Math.round(innerW * s));
  const newInnerH = Math.max(1, Math.round(innerH * s));
  return {
    w: newInnerW + PICTURE_MAT_OUTER_GROW_PX,
    h: newInnerH + PICTURE_MAT_OUTER_GROW_PX,
  };
}

function stackOuterSize(maxWidth: number, maxHeight: number) {
  return {
    effW: maxWidth,
    effH: maxHeight,
    innerW: maxWidth + 2 * VAULT_PILE_MARGIN_PX + PICTURE_MAT_OUTER_GROW_PX,
    innerH: maxHeight + 2 * VAULT_PILE_MARGIN_PX + PICTURE_MAT_OUTER_GROW_PX,
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
  respectItemCaps = true,
): { w: number; h: number } {
  const mw = respectItemCaps ? (item.maxWidth ?? maxWidth) : maxWidth;
  const mh = respectItemCaps ? (item.maxHeight ?? maxHeight) : maxHeight;
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
  respectItemCaps = true,
}: {
  item: VaultPictureItem;
  maxWidth: number;
  maxHeight: number;
  reportStackOuter: (itemId: string, w: number, h: number) => void;
  respectItemCaps?: boolean;
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
            respectItemCaps,
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

function clampRange(v: number, lo: number, hi: number): number {
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
      const x = clampRange(ax - w / 2, PAD, sceneW - PAD - w);
      const y = clampRange(ay - h / 2, PAD, sceneH - PAD - h);
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
  const [backdropEntered, setBackdropEntered] = useState(false);
  const [focusedZoomId, setFocusedZoomId] = useState<string | null>(null);
  const [zoomLiftId, setZoomLiftId] = useState<string | null>(null);
  const focusedZoomIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    focusedZoomIdRef.current = focusedZoomId;
  }, [focusedZoomId]);

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

  useLayoutEffect(() => {
    const next = posForAnchorCenter(initialLeft, initialTop, maxWidth, maxHeight);
    posRef.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync pile origin when parent anchor updates (resize)
    setPos(next);
    notifyPos.current();
  }, [initialLeft, initialTop, maxWidth, maxHeight]);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  /** After open: stack pose, then next frame cluster + scrim (prototype `init`). */
  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!alive) return;
        setExpandSpread(true);
        setBackdropEntered(true);
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
        const c = clampVaultPosition(nx, ny, w, h);
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
    [cancelGlide],
  );

  const expandStack = useCallback(() => {
    if (collapseCloseTimeoutRef.current != null) {
      clearTimeout(collapseCloseTimeoutRef.current);
      collapseCloseTimeoutRef.current = null;
    }
    setBackdropEntered(false);
    setFocusedZoomId(null);
    setZoomLiftId(null);
    setExpandSpread(false);
    setExpanded(true);
  }, []);

  const collapseStack = useCallback(() => {
    if (collapseCloseTimeoutRef.current != null) {
      clearTimeout(collapseCloseTimeoutRef.current);
      collapseCloseTimeoutRef.current = null;
    }
    setExpandSpread(false);
    setBackdropEntered(false);
    setFocusedZoomId(null);
    setZoomLiftId(null);
    collapseCloseTimeoutRef.current = window.setTimeout(() => {
      collapseCloseTimeoutRef.current = null;
      setExpanded(false);
    }, CARD_TRANSITION_MS);
  }, []);

  const openVaultPictureZoom = useCallback((itemId: string) => {
    if (prefersReducedMotion()) {
      flushSync(() => {
        setZoomLiftId(null);
        setFocusedZoomId(itemId);
      });
      return;
    }
    flushSync(() => {
      setZoomLiftId(itemId);
    });
    const doc = getDocumentViewTransition();
    const runMorph = () => {
      if (typeof doc?.startViewTransition === "function") {
        doc.startViewTransition(() => {
          flushSync(() => {
            setFocusedZoomId(itemId);
            setZoomLiftId(null);
          });
        });
      } else {
        flushSync(() => {
          setFocusedZoomId(itemId);
          setZoomLiftId(null);
        });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(runMorph);
    });
  }, []);

  const closeVaultPictureZoom = useCallback(() => {
    const id = focusedZoomIdRef.current;
    if (id == null) return;
    if (prefersReducedMotion()) {
      flushSync(() => {
        setFocusedZoomId(null);
        setZoomLiftId(null);
      });
      return;
    }
    const doc = getDocumentViewTransition();
    if (typeof doc?.startViewTransition === "function") {
      document.documentElement.classList.add(VAULT_PICTURE_VT_EXIT_CLASS);
      const vt = doc.startViewTransition(() => {
        flushSync(() => {
          setFocusedZoomId(null);
          setZoomLiftId(id);
        });
      });
      void vt.finished.finally(() => {
        document.documentElement.classList.remove(VAULT_PICTURE_VT_EXIT_CLASS);
        setZoomLiftId(null);
      });
    } else {
      flushSync(() => {
        setFocusedZoomId(null);
        setZoomLiftId(id);
      });
      window.setTimeout(() => {
        setZoomLiftId(null);
      }, CARD_TRANSITION_MS);
    }
  }, []);

  const onBackdropClick = useCallback(() => {
    if (focusedZoomIdRef.current != null) {
      closeVaultPictureZoom();
    } else {
      collapseStack();
    }
  }, [closeVaultPictureZoom, collapseStack]);

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
      const c = clampVaultPosition(nx, ny, d.width, d.height);
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
    [],
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
        const c = clampVaultPosition(p.x, p.y, rect.width, rect.height);
        if (c.x === p.x && c.y === p.y) return p;
        posRef.current = c;
        return c;
      });
      notifyPos.current();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (focusedZoomIdRef.current != null) {
          closeVaultPictureZoom();
        } else {
          collapseStack();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, collapseStack, closeVaultPictureZoom]);

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
                      ? `0 ${2 + vp * 2}px ${8 + vp * 4}px rgba(0,0,0,0.32), var(--vault-picture-mat-shadow)`
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
                  opacity: backdropEntered ? 1 : 0,
                  backgroundColor:
                    "color-mix(in srgb, var(--background) 10%, transparent)",
                  WebkitBackdropFilter: backdropEntered
                    ? "blur(2px)"
                    : "blur(0px)",
                  backdropFilter: backdropEntered ? "blur(2px)" : "blur(0px)",
                  transition: OVERLAY_BACKDROP_TRANSITION,
                }}
                aria-label="Close picture gallery"
                onClick={onBackdropClick}
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
                  ? `0 4px 18px rgba(0,0,0,0.24), var(--vault-picture-mat-shadow)`
                  : isVis
                    ? `0 ${2 + vp * 2}px ${8 + vp * 4}px rgba(0,0,0,0.32), var(--vault-picture-mat-shadow)`
                    : "none";
                const zPortal =
                  useClusterPose && slotIdx >= 0
                    ? 200 + slotIdx
                    : isVis
                      ? 10 + vp
                      : 5;
                const zTile =
                  zoomLiftId === item.id ? ZOOM_GRID_LIFT_Z : zPortal;

                if (useClusterPose && focusedZoomId === item.id) {
                  return (
                    <div
                      key={item.id}
                      className="fixed pointer-events-none"
                      style={{
                        left,
                        top,
                        width: w,
                        height: h,
                        zIndex: zPortal,
                        visibility: "hidden",
                      }}
                      aria-hidden
                    />
                  );
                }

                const vtStyle: ViewTransitionCss | undefined =
                  useClusterPose && focusedZoomId !== item.id
                    ? {
                        viewTransitionName: vaultPictureVtName(item.id),
                        viewTransitionClass: "vault-cambio",
                      }
                    : undefined;

                return (
                  <Fragment key={item.id}>
                    <div
                      className="fixed cursor-pointer select-none"
                      style={{
                        ...PICTURE_MAT_OUTER_STYLE,
                        ...(vtStyle as CSSProperties),
                        left,
                        top,
                        width: w,
                        height: h,
                        zIndex: zTile,
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
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!useClusterPose) return;
                        openVaultPictureZoom(item.id);
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
              {focusedZoomId != null
                ? (() => {
                    const zi = items.findIndex((it) => it.id === focusedZoomId);
                    const item = zi >= 0 ? items[zi]! : null;
                    if (item == null) return null;
                    const { w: ow, h: oh } = sizes[zi]!;
                    const { w: zw, h: zh } = zoomOuterDisplaySize(
                      ow,
                      oh,
                      viewport.w,
                      viewport.h,
                    );
                    const innerCapW = zw - PICTURE_MAT_OUTER_GROW_PX;
                    const innerCapH = zh - PICTURE_MAT_OUTER_GROW_PX;
                    const vtName = vaultPictureVtName(item.id);
                    const zoomLeft = (viewport.w - zw) / 2;
                    const showFooter =
                      (item.caption != null && item.caption.trim() !== "") ||
                      (item.captionYear != null &&
                        item.captionYear.trim() !== "");
                    const link =
                      item.captionUrl != null && item.captionUrl.trim() !== ""
                        ? item.captionUrl.trim()
                        : null;
                    const captionReserve = showFooter ? 52 : 0;
                    const zoomTop = Math.max(
                      8,
                      (viewport.h - zh - captionReserve) / 2,
                    );
                    const rowClass =
                      "flex w-full min-w-0 items-start justify-between gap-x-[16px]";
                    const footerInner = (
                      <>
                        <div className="min-w-0 flex-1 text-left">
                          {item.caption != null && item.caption.trim() !== "" ? (
                            <p>{item.caption.trim()}</p>
                          ) : null}
                        </div>
                        {item.captionYear != null &&
                        item.captionYear.trim() !== "" ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <span>{item.captionYear.trim()}</span>
                            <ArrowUpRight
                              className={`h-[11px] w-[11px] shrink-0${link != null ? "" : " opacity-50"}`}
                              width={11}
                              height={11}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          </div>
                        ) : null}
                      </>
                    );
                    return (
                      <div
                        role="dialog"
                        aria-label={item.alt}
                        className="fixed inline-flex cursor-pointer select-none flex-col items-stretch leading-none"
                        style={
                          {
                            ...PICTURE_MAT_OUTER_STYLE,
                            viewTransitionName: vtName,
                            viewTransitionClass: "vault-cambio",
                            left: zoomLeft,
                            top: zoomTop,
                            width: zw,
                            minHeight: zh,
                            zIndex: ZOOM_MODAL_Z,
                            boxShadow: `0 12px 40px rgba(0,0,0,0.35), var(--vault-picture-mat-shadow)`,
                            transition: "none",
                          } as ViewTransitionCss
                        }
                        onClick={closeVaultPictureZoom}
                      >
                        <VaultPictureMatInner
                          item={item}
                          maxWidth={Math.max(1, innerCapW)}
                          maxHeight={Math.max(1, innerCapH)}
                          respectItemCaps={false}
                          reportStackOuter={() => {}}
                        />
                        {showFooter ? (
                          <div className="mt-[4px] w-full min-w-0 font-mono text-[10px] leading-snug text-secondary">
                            {link != null ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${rowClass} rounded-sm text-secondary no-underline underline-offset-2 hover:text-foreground hover:underline`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {footerInner}
                              </a>
                            ) : (
                              <div className={rowClass}>{footerInner}</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
