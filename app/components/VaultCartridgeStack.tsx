"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { vaultCartridgeFanScale, vaultCartridgeDragClamp, VAULT_OVERLAY_BACKDROP_BUTTON_CLASS, vaultOverlayBackdropStyle, vaultOverlayZIndex } from "./vaultRects";
import {
  pickCartridgeEmbed,
  VAULT_CARTRIDGE_ITEMS,
  VAULT_GBA_BOOT_VIDEO,
} from "./vaultCartridgeData";
import {
  CARTRIDGE_CARD_H,
  CARTRIDGE_CARD_W,
  CARTRIDGE_COUNT,
  CARTRIDGE_SCATTER,
  CARTRIDGE_SLOT_ORDER,
  CARTRIDGE_STEP_H,
  CARTRIDGE_STEP_V,
  CARTRIDGE_VISIBLE_FAN,
  cartridgeExpandedXY,
  cartridgeGroupLayout,
  cartridgeHeroAnimMs,
  cartridgeHeroShouldStagger,
  cartridgeNeedsScroll,
  cartridgeRepCardPos,
  cartridgeScatterFixedPos,
  heroCartridgeTransitionDelay,
  isCartridgeMobile,
} from "./vaultCartridgeLayout";
import { useClientMounted } from "./useClientMounted";
import { eventTargetWithin } from "./uiPlacement";
import {
  useVaultSpawnEnter,
  vaultSpawnLayerTransition,
} from "./vaultSpawnEnter";
import "./VaultCartridgeStack.css";

type VaultCartridgeStackProps = {
  id: string;
  zIndex: number;
  onInteractionStart: (id: string) => void;
  initialLeft: number;
  initialTop: number;
  footprintW: number;
  footprintH: number;
  pileScale: number;
};

const TAP_MOVE_THRESHOLD_PX = 8;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;
const GAMEBOY_BOOT_DELAY_MS = 300;
const SCROLL_FADE_MS = 400;
const CARTRIDGE_HOVER_SCATTER_MUL = 1.08;
const CARTRIDGE_HOVER_SCALE_MUL = 1.03;
const PILE_SHELL_HOVER_TRANSITION =
  "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)";

function posFromAnchor(cx: number, cy: number, w: number, h: number) {
  return { x: cx - w / 2, y: cy - h / 2 };
}

function bindCartridgeFilterRepaint(root: ParentNode | null): () => void {
  if (!root) return () => {};

  const imgs = root.querySelectorAll<HTMLImageElement>(
    ".vault-cartridge-card__inner img",
  );
  if (imgs.length === 0) return () => {};

  let cancelled = false;
  const cleanups: (() => void)[] = [];

  const repaint = () => {
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (cancelled) return;
      for (const img of imgs) img.style.setProperty("-webkit-filter", "opacity(1)");
      void imgs[0]?.offsetHeight;
      for (const img of imgs) img.style.removeProperty("-webkit-filter");
    });
  };

  let awaiting = 0;
  const onReady = () => {
    if (--awaiting <= 0) repaint();
  };

  for (const img of imgs) {
    if (img.complete) continue;
    awaiting++;
    img.addEventListener("load", onReady);
    img.addEventListener("error", onReady);
    cleanups.push(() => {
      img.removeEventListener("load", onReady);
      img.removeEventListener("error", onReady);
    });
  }

  if (awaiting === 0) repaint();

  return () => {
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
  };
}

function CartridgeImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="vault-cartridge-card__inner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
}

function CartridgeCardPose({
  transform,
  transitionDelay,
  transition,
  children,
}: {
  transform?: string;
  transitionDelay?: string;
  transition?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="vault-cartridge-card__pose"
      style={{ transform, transitionDelay, transition }}
    >
      {children}
    </div>
  );
}

function CartridgeScrollFades({
  mobile,
  visible,
}: {
  mobile: boolean;
  visible: boolean;
}) {
  const suffix = visible ? " vault-cartridge-fade--visible" : "";
  if (mobile) {
    return (
      <>
        <div className={`vault-cartridge-fade vault-cartridge-fade--left${suffix}`} />
        <div className={`vault-cartridge-fade vault-cartridge-fade--right${suffix}`} />
      </>
    );
  }
  return (
    <>
      <div className={`vault-cartridge-fade vault-cartridge-fade--top${suffix}`} />
      <div className={`vault-cartridge-fade vault-cartridge-fade--bottom${suffix}`} />
    </>
  );
}

export default function VaultCartridgeStack({
  id,
  zIndex,
  onInteractionStart,
  initialLeft,
  initialTop,
  footprintW,
  footprintH,
  pileScale,
}: VaultCartridgeStackProps) {
  const [pos, setPos] = useState(() =>
    posFromAnchor(initialLeft, initialTop, footprintW, footprintH),
  );
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tapPending, setTapPending] = useState(false);
  const [repPhase, setRepPhase] = useState(false);
  const [heroPose, setHeroPose] = useState<"scatter" | "list">("scatter");
  const [heroMotion, setHeroMotion] = useState(true);
  const [collapsing, setCollapsing] = useState(false);
  const [backdropEntered, setBackdropEntered] = useState(false);
  const [scrollFadesShown, setScrollFadesShown] = useState(false);
  const [scrollFadeHold, setScrollFadeHold] = useState(false);
  const scrollFadeHoldTimerRef = useRef<number | null>(null);
  const [selectedCartridgeIdx, setSelectedCartridgeIdx] = useState<number | null>(
    null,
  );
  const [mediaKey, setMediaKey] = useState<"boot" | "youtube" | null>(null);
  const [youtubeEmbed, setYoutubeEmbed] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1200, h: 800 },
  );
  const mounted = useClientMounted();
  const { entered: spawnEntered, settled: spawnSettled } = useVaultSpawnEnter();

  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const dragCommittedRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: footprintW, h: footprintH });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const glideRafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const expandedOverlayRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(pos);
  const userMovedRef = useRef(false);
  const expandTimerRef = useRef<number | null>(null);
  const bootTimerRef = useRef<number | null>(null);
  const scrollPosRef = useRef(0);
  const isDraggingScrollRef = useRef(false);
  const scrollDragStartRef = useRef(0);
  const repLayerRef = useRef<HTMLDivElement | null>(null);
  const repCardElsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lastPlayedIdxRef = useRef<number | null>(null);
  const collapsingRef = useRef(false);

  const mobile = isCartridgeMobile(viewport.w);
  const layout = useMemo(
    () => cartridgeGroupLayout(viewport.w, viewport.h, mobile),
    [viewport.w, viewport.h, mobile],
  );
  const needsScroll = cartridgeNeedsScroll(viewport.w, viewport.h, mobile);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useLayoutEffect(() => {
    const sync = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useLayoutEffect(() => {
    const unbind = [
      bindCartridgeFilterRepaint(elRef.current),
      bindCartridgeFilterRepaint(expandedOverlayRef.current),
    ];
    return () => unbind.forEach((fn) => fn());
  }, [expanded, repPhase, heroPose, scrollFadeHold]);

  useLayoutEffect(() => {
    if (expanded || userMovedRef.current) return;
    const next = posFromAnchor(initialLeft, initialTop, footprintW, footprintH);
    posRef.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync anchor when parent spawn updates
    setPos(next);
  }, [initialLeft, initialTop, footprintW, footprintH, expanded]);

  const cancelGlide = useCallback(() => {
    if (glideRafRef.current !== null) {
      cancelAnimationFrame(glideRafRef.current);
      glideRafRef.current = null;
    }
    setGliding(false);
  }, []);

  const clearScrollFadeHoldTimer = useCallback(() => {
    if (scrollFadeHoldTimerRef.current !== null) {
      window.clearTimeout(scrollFadeHoldTimerRef.current);
      scrollFadeHoldTimerRef.current = null;
    }
  }, []);

  const beginScrollFadeExit = useCallback(
    (holdMs = SCROLL_FADE_MS) => {
      setScrollFadesShown(false);
      setScrollFadeHold(true);
      clearScrollFadeHoldTimer();
      scrollFadeHoldTimerRef.current = window.setTimeout(() => {
        scrollFadeHoldTimerRef.current = null;
        setScrollFadeHold(false);
      }, holdMs);
    },
    [clearScrollFadeHoldTimer],
  );

  useEffect(() => {
    if (!(expanded && needsScroll && !collapsing)) return;

    let alive = true;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (alive) setScrollFadesShown(true);
      });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
      setScrollFadesShown(false);
    };
  }, [expanded, needsScroll, collapsing]);

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current !== null) {
      window.clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const clearBootTimer = useCallback(() => {
    if (bootTimerRef.current !== null) {
      window.clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
    }
  }, []);

  const stopMedia = useCallback(() => {
    clearBootTimer();
    setMediaKey(null);
    setYoutubeEmbed(null);
  }, [clearBootTimer]);

  const scheduleBootVideo = useCallback(() => {
    clearBootTimer();
    bootTimerRef.current = window.setTimeout(() => {
      bootTimerRef.current = null;
      setYoutubeEmbed(null);
      setMediaKey("boot");
    }, GAMEBOY_BOOT_DELAY_MS);
  }, [clearBootTimer]);

  const playCartridgeVideo = useCallback(
    (cardIdx: number) => {
      if (lastPlayedIdxRef.current === cardIdx) return;
      lastPlayedIdxRef.current = cardIdx;
      clearBootTimer();
      const item = VAULT_CARTRIDGE_ITEMS[cardIdx];
      const embed = pickCartridgeEmbed(item.videos);
      const url = embed + (embed.includes("?") ? "&" : "?") + "autoplay=1";
      setMediaKey("youtube");
      setYoutubeEmbed(url);
    },
    [clearBootTimer],
  );

  const resetSelection = useCallback(() => {
    lastPlayedIdxRef.current = null;
    setSelectedCartridgeIdx(null);
    stopMedia();
  }, [stopMedia]);

  const resetRepScroll = useCallback(() => {
    isDraggingScrollRef.current = false;
    scrollPosRef.current = 0;
  }, []);

  const disposeRepCards = useCallback(
    (scroll: number) => {
      scrollPosRef.current = scroll;
      const step = mobile ? CARTRIDGE_STEP_H : CARTRIDGE_STEP_V;
      const wrap = CARTRIDGE_COUNT * step;
      if (Math.abs(scrollPosRef.current) > wrap * 1000) {
        scrollPosRef.current -= Math.round(scrollPosRef.current / wrap) * wrap;
      }
      const layoutScroll = scrollPosRef.current;
      repCardElsRef.current.forEach((el, row) => {
        if (!el) return;
        const { x, y } = cartridgeRepCardPos(row, layoutScroll, layout, mobile);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      });
    },
    [layout, mobile],
  );

  const updateRepScroll = useCallback(
    (delta: number) => {
      scrollPosRef.current += delta;
      disposeRepCards(scrollPosRef.current);
    },
    [disposeRepCards],
  );

  const expandStack = useCallback(() => {
    clearExpandTimer();
    clearScrollFadeHoldTimer();
    collapsingRef.current = false;
    setCollapsing(false);
    setScrollFadeHold(false);
    setScrollFadesShown(false);
    resetSelection();
    setRepPhase(false);
    setHeroPose("scatter");
    setHeroMotion(true);
    setBackdropEntered(false);
    setExpanded(true);
    scheduleBootVideo();
    expandTimerRef.current = window.setTimeout(() => {
      expandTimerRef.current = null;
      setHeroMotion(false);
      setRepPhase(true);
    }, cartridgeHeroAnimMs("list") + 80);
  }, [
    clearExpandTimer,
    clearScrollFadeHoldTimer,
    resetSelection,
    scheduleBootVideo,
  ]);

  const collapseStack = useCallback(() => {
    if (!expanded || collapsingRef.current) return;
    const scatterMs = cartridgeHeroAnimMs("scatter") + 80;
    collapsingRef.current = true;
    setCollapsing(true);
    beginScrollFadeExit(scatterMs + SCROLL_FADE_MS);
    clearExpandTimer();
    resetSelection();
    resetRepScroll();
    setRepPhase(false);
    setBackdropEntered(false);
    setHeroMotion(false);
    setHeroPose("list");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHeroMotion(true);
        setHeroPose("scatter");
      });
    });

    expandTimerRef.current = window.setTimeout(() => {
      expandTimerRef.current = null;
      setExpanded(false);
      setCollapsing(false);
      collapsingRef.current = false;
      setHeroPose("scatter");
      setHeroMotion(true);
    }, scatterMs);
  }, [beginScrollFadeExit, clearExpandTimer, expanded, resetSelection, resetRepScroll]);

  const startGlide = useCallback(
    (vx: number, vy: number) => {
      if (Math.hypot(vx, vy) < GLIDE_SPEED_MIN) {
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
          return;
        }

        const friction = Math.exp(-FRICTION_PER_MS * dtMs);
        const p = posRef.current;
        const nx = p.x + gvx * dtMs;
        const ny = p.y + gvy * dtMs;
        const c = vaultCartridgeDragClamp(nx, ny, viewport.w, footprintW, footprintH);
        if (c.x !== nx) gvx = 0;
        if (c.y !== ny) gvy = 0;
        gvx *= friction;
        gvy *= friction;
        posRef.current = c;
        setPos(c);

        if (Math.hypot(gvx, gvy) < GLIDE_STOP) {
          glideRafRef.current = null;
          setGliding(false);
          userMovedRef.current = true;
          return;
        }

        glideRafRef.current = requestAnimationFrame(tick);
      };

      glideRafRef.current = requestAnimationFrame(tick);
    },
    [cancelGlide, footprintW, footprintH, viewport.w],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || expanded) return;
      if (!eventTargetWithin(e.target, ".vault-cartridge-card")) return;
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
      setTapPending(true);
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
        if (!dragCommittedRef.current) {
          dragCommittedRef.current = true;
          userMovedRef.current = true;
          setHovered(false);
          setTapPending(false);
        }
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
      const c = vaultCartridgeDragClamp(nx, ny, viewport.w, footprintW, footprintH);
      posRef.current = c;
      setPos((p) => (c.x !== p.x || c.y !== p.y ? c : p));
    },
    [footprintW, footprintH, viewport.w],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { vx, vy } = velocityRef.current;
      const wasTap = !dragCommittedRef.current;
      dragRef.current = null;
      setDragging(false);
      setTapPending(false);
      elRef.current?.releasePointerCapture(e.pointerId);
      if (wasTap && !expanded) {
        expandStack();
        return;
      }
      startGlide(vx, vy);
    },
    [expanded, expandStack, startGlide],
  );

  useEffect(
    () => () => {
      cancelGlide();
      clearExpandTimer();
      clearBootTimer();
      clearScrollFadeHoldTimer();
      resetRepScroll();
    },
    [cancelGlide, clearBootTimer, clearExpandTimer, clearScrollFadeHoldTimer, resetRepScroll],
  );

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!alive) return;
        setBackdropEntered(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id1);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded || heroPose !== "scatter" || collapsing) {
      return;
    }
    let alive = true;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!alive || collapsingRef.current) return;
        setHeroPose("list");
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [expanded, heroPose, collapsing]);

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

  useEffect(() => {
    if (!repPhase || !needsScroll) return;

    const onWheel = (e: WheelEvent) => {
      if (mobile) {
        updateRepScroll(
          -(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.8,
        );
      } else {
        updateRepScroll(-e.deltaY * 0.8);
      }
    };

    const onDragStart = (e: MouseEvent | TouchEvent) => {
      isDraggingScrollRef.current = true;
      const pt = "touches" in e ? e.touches[0] : e;
      if (!pt) return;
      scrollDragStartRef.current = mobile ? pt.clientX : pt.clientY;
    };

    const onDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingScrollRef.current) return;
      const pt = "touches" in e ? e.touches[0] : e;
      if (!pt) return;
      const cur = mobile ? pt.clientX : pt.clientY;
      const delta = cur - scrollDragStartRef.current;
      updateRepScroll(delta * 2);
      scrollDragStartRef.current = cur;
    };

    const onDragEnd = () => {
      isDraggingScrollRef.current = false;
    };

    const layer = repLayerRef.current;

    window.addEventListener("wheel", onWheel, { passive: true });
    if (layer) {
      layer.addEventListener("mousedown", onDragStart);
      layer.addEventListener("touchstart", onDragStart, { passive: true });
    }
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("touchmove", onDragMove, { passive: true });
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("touchend", onDragEnd);

    return () => {
      window.removeEventListener("wheel", onWheel);
      if (layer) {
        layer.removeEventListener("mousedown", onDragStart);
        layer.removeEventListener("touchstart", onDragStart);
      }
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchend", onDragEnd);
    };
  }, [mobile, needsScroll, repPhase, updateRepScroll]);

  useLayoutEffect(() => {
    if (repPhase) {
      disposeRepCards(scrollPosRef.current);
    }
  }, [repPhase, layout, mobile, disposeRepCards]);

  const motionActive = dragging || gliding;
  const hoverAffordance = hovered || tapPending;
  const pileHovered = hoverAffordance && !expanded && !gliding;
  const scatterMul =
    hoverAffordance && !gliding && (!expanded || heroPose === "scatter")
      ? CARTRIDGE_HOVER_SCATTER_MUL
      : 1;
  const shellTransform = dragging
    ? "scale(1.02)"
    : pileHovered
      ? `scale(${CARTRIDGE_HOVER_SCALE_MUL})`
      : undefined;
  const fanScale = vaultCartridgeFanScale(viewport.w, pileScale);
  const fanCardW = CARTRIDGE_CARD_W * fanScale;
  const fanCardH = CARTRIDGE_CARD_H * fanScale;
  const fanOriginX = footprintW / 2 - fanCardW / 2;
  const fanOriginY = footprintH / 2 - fanCardH / 2;
  const panelVisible = expanded && (repPhase || heroPose === "list");
  const overlayShellOpen = expanded || scrollFadeHold;

  const collapsedPile = (
    <div
      ref={elRef}
      data-spawn-peer={id}
      className="vault-artifact touch-none select-none outline-none focus:outline-none"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: footprintW,
        height: footprintH,
        zIndex,
        overflow: "visible",
        cursor: dragging || gliding ? "grabbing" : "default",
        transform: shellTransform,
        transformOrigin: "center center",
        visibility: expanded ? "hidden" : "visible",
        pointerEvents: expanded || !spawnEntered ? "none" : "auto",
        transition: motionActive
          ? "none"
          : PILE_SHELL_HOVER_TRANSITION,
      }}
      onPointerEnter={() => {
        if (!expanded && !motionActive) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      {VAULT_CARTRIDGE_ITEMS.slice(0, CARTRIDGE_VISIBLE_FAN).map((item, i) => {
        const s = CARTRIDGE_SCATTER[i % CARTRIDGE_SCATTER.length]!;
        const scatterLeft = fanOriginX + s.ox * pileScale * scatterMul;
        const scatterTop = fanOriginY + s.oy * pileScale * scatterMul;
        return (
          <div
            key={item.id}
            className="vault-cartridge-card vault-cartridge-card--pile"
            style={{
              left: spawnEntered ? scatterLeft : fanOriginX,
              top: spawnEntered ? scatterTop : fanOriginY,
              zIndex: CARTRIDGE_VISIBLE_FAN - i,
              opacity: spawnEntered ? 1 : 0,
              pointerEvents: spawnEntered ? "auto" : "none",
              cursor: dragging || gliding ? "grabbing" : "grab",
              transition: vaultSpawnLayerTransition(
                spawnEntered,
                spawnSettled,
                motionActive,
                true,
              ),
            }}
          >
            <CartridgeCardPose
              transform={
                spawnEntered
                  ? `rotate(${s.rotate}deg) scale(${fanScale})`
                  : `rotate(0deg) scale(${fanScale * 0.88})`
              }
              transition={vaultSpawnLayerTransition(
                spawnEntered,
                spawnSettled,
                motionActive,
              )}
            >
              <CartridgeImage src={item.src} alt={item.alt} />
            </CartridgeCardPose>
          </div>
        );
      })}
    </div>
  );

  const expandedOverlay = overlayShellOpen ? (
    <div
      ref={expandedOverlayRef}
      className="fixed inset-0 touch-none"
      style={{
        zIndex: vaultOverlayZIndex(zIndex),
        pointerEvents: expanded ? "auto" : "none",
      }}
    >
      {expanded ? (
        <>
          <button
            type="button"
            className={VAULT_OVERLAY_BACKDROP_BUTTON_CLASS}
            style={vaultOverlayBackdropStyle(backdropEntered)}
            aria-label="Close cartridge gallery"
            onClick={collapseStack}
          />

          <div
            className={`vault-gameboy-panel${panelVisible ? " vault-gameboy-panel--visible" : ""}`}
            style={{ left: layout.panelX, top: layout.panelY }}
            aria-label="Game Boy Advance SP"
            onClick={collapseStack}
          >
            <div className="vault-gameboy-panel__inner">
              <div className="vault-gameboy-shell" aria-hidden />
              <div className="vault-gameboy-screen">
                <div className="vault-gameboy-media">
                  {mediaKey === "boot" ? (
                    <video
                      key="boot"
                      src={VAULT_GBA_BOOT_VIDEO}
                      autoPlay
                      playsInline
                      muted
                    />
                  ) : null}
                  {mediaKey === "youtube" && youtubeEmbed ? (
                    <iframe
                      key={youtubeEmbed}
                      src={youtubeEmbed}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {!repPhase
            ? VAULT_CARTRIDGE_ITEMS.map((item, i) => {
                const scatter = cartridgeScatterFixedPos(
                  i,
                  pos.x,
                  pos.y,
                  footprintW,
                  footprintH,
                  fanScale,
                  pileScale * scatterMul,
                );
                const list = cartridgeExpandedXY(i, layout, mobile);
                const pose = heroPose === "list" ? list : scatter;
                const heroDelay =
                  heroMotion && cartridgeHeroShouldStagger(mobile, collapsing)
                    ? `${heroCartridgeTransitionDelay(i, heroPose)}ms`
                    : "0ms";
                const opacity = heroPose === "list" ? 1 : scatter.opacity;
                const heroScale = heroPose === "list" ? 1 : scatter.scale;
                return (
                  <div
                    key={item.id}
                    className={`vault-cartridge-card${heroMotion ? "" : " vault-cartridge-card--hero-frozen"}`}
                    style={{
                      position: "fixed",
                      left: pose.x,
                      top: pose.y,
                      zIndex: CARTRIDGE_COUNT - i,
                      opacity,
                      pointerEvents: collapsing ? "none" : "auto",
                      transitionDelay: heroDelay,
                    }}
                  >
                    <CartridgeCardPose
                      transform={`rotate(${heroPose === "list" ? 0 : scatter.rotate}deg) scale(${heroScale})`}
                      transitionDelay={heroDelay}
                    >
                      <CartridgeImage src={item.src} alt={item.alt} />
                    </CartridgeCardPose>
                  </div>
                );
              })
            : null}

          {repPhase ? (
            <div
              ref={repLayerRef}
              className="fixed inset-0"
              style={{ zIndex: 4, pointerEvents: "none" }}
            >
              {CARTRIDGE_SLOT_ORDER.map((cardIdx, row) => {
                const item = VAULT_CARTRIDGE_ITEMS[cardIdx]!;
                const isSelected = selectedCartridgeIdx === cardIdx;
                const repPos = cartridgeRepCardPos(row, 0, layout, mobile);
                return (
                  <button
                    key={`rep-${item.id}`}
                    type="button"
                    ref={(node) => {
                      repCardElsRef.current[row] = node;
                    }}
                    className={`vault-cartridge-card vault-cartridge-card--rep${isSelected ? " vault-cartridge-card--selected" : ""}`}
                    style={{
                      position: "fixed",
                      left: repPos.x,
                      top: repPos.y,
                      pointerEvents: "auto",
                    }}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedCartridgeIdx(cardIdx);
                      playCartridgeVideo(cardIdx);
                    }}
                  >
                    <CartridgeCardPose>
                      <CartridgeImage src={item.src} alt={item.alt} />
                    </CartridgeCardPose>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {needsScroll && overlayShellOpen ? (
        <CartridgeScrollFades mobile={mobile} visible={scrollFadesShown} />
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {mounted ? createPortal(collapsedPile, document.body) : collapsedPile}
      {overlayShellOpen && mounted
        ? createPortal(expandedOverlay, document.body)
        : expandedOverlay}
    </>
  );
}
