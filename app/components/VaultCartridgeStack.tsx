"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { clampVaultPosition, VAULT_OVERLAY_BACKDROP_BUTTON_CLASS, vaultOverlayBackdropStyle, vaultOverlayZIndex } from "./vaultRects";
import {
  pickCartridgeEmbed,
  VAULT_CARTRIDGE_ITEMS,
  VAULT_GBA_BOOT_VIDEO,
} from "./vaultCartridgeData";
import {
  CARTRIDGE_ANIM_MS,
  CARTRIDGE_CARD_H,
  CARTRIDGE_CARD_W,
  CARTRIDGE_COUNT,
  CARTRIDGE_FAN_SCALE,
  CARTRIDGE_SCATTER,
  CARTRIDGE_SLOT_ORDER,
  CARTRIDGE_STEP_H,
  CARTRIDGE_STEP_V,
  CARTRIDGE_VISIBLE_FAN,
  cartridgeExpandedXY,
  cartridgeGroupLayout,
  cartridgeNeedsScroll,
  cartridgeRepCardPos,
  cartridgeScatterFixedPos,
  heroCartridgeTransitionDelay,
  isCartridgeMobile,
} from "./vaultCartridgeLayout";
import { useClientMounted } from "./useClientMounted";
import "./VaultCartridgeStack.css";

type VaultCartridgeStackProps = {
  id: string;
  zIndex: number;
  onInteractionStart: (id: string) => void;
  initialLeft: number;
  initialTop: number;
  footprintW: number;
  footprintH: number;
};

const TAP_MOVE_THRESHOLD_PX = 8;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;
const GAMEBOY_BOOT_DELAY_MS = 300;

function posFromAnchor(cx: number, cy: number, w: number, h: number) {
  return { x: cx - w / 2, y: cy - h / 2 };
}

function lerp(a: number, b: number, t: number) {
  return a * (1 - t) + b * t;
}

function CartridgeImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="vault-cartridge-card__inner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} />
    </div>
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
}: VaultCartridgeStackProps) {
  const [pos, setPos] = useState(() =>
    posFromAnchor(initialLeft, initialTop, footprintW, footprintH),
  );
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [repPhase, setRepPhase] = useState(false);
  const [heroPose, setHeroPose] = useState<"scatter" | "list">("scatter");
  const [heroMotion, setHeroMotion] = useState(true);
  const [collapsing, setCollapsing] = useState(false);
  const [backdropEntered, setBackdropEntered] = useState(false);
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
  const posRef = useRef(pos);
  const userMovedRef = useRef(false);
  const expandTimerRef = useRef<number | null>(null);
  const bootTimerRef = useRef<number | null>(null);
  const scrollPosRef = useRef(0);
  const currentScrollRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
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

  const stopScrollLoop = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    isDraggingScrollRef.current = false;
    scrollPosRef.current = 0;
    currentScrollRef.current = 0;
  }, []);

  const disposeRepCards = useCallback(
    (scroll: number) => {
      const step = mobile ? CARTRIDGE_STEP_H : CARTRIDGE_STEP_V;
      const wrap = CARTRIDGE_COUNT * step;
      repCardElsRef.current.forEach((el, row) => {
        if (!el) return;
        const { x, y } = cartridgeRepCardPos(row, scroll, layout, mobile);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      });
      if (Math.abs(scrollPosRef.current) > wrap * 1000) {
        const excess = Math.round(scrollPosRef.current / wrap) * wrap;
        scrollPosRef.current -= excess;
        currentScrollRef.current -= excess;
      }
    },
    [layout, mobile],
  );

  const startScrollLoop = useCallback(() => {
    const tick = () => {
      scrollRafRef.current = requestAnimationFrame(tick);
      currentScrollRef.current = lerp(
        currentScrollRef.current,
        scrollPosRef.current,
        0.1,
      );
      disposeRepCards(currentScrollRef.current);
    };
    tick();
  }, [disposeRepCards]);

  const expandStack = useCallback(() => {
    clearExpandTimer();
    collapsingRef.current = false;
    setCollapsing(false);
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
      if (needsScroll) startScrollLoop();
    }, CARTRIDGE_ANIM_MS + 80);
  }, [
    clearExpandTimer,
    needsScroll,
    resetSelection,
    scheduleBootVideo,
    startScrollLoop,
  ]);

  const collapseStack = useCallback(() => {
    if (!expanded || collapsingRef.current) return;
    collapsingRef.current = true;
    setCollapsing(true);
    clearExpandTimer();
    resetSelection();
    stopScrollLoop();
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
      collapsingRef.current = false;
      setCollapsing(false);
      setExpanded(false);
      setHeroPose("scatter");
      setHeroMotion(true);
    }, CARTRIDGE_ANIM_MS + 80);
  }, [clearExpandTimer, expanded, resetSelection, stopScrollLoop]);

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
        const c = clampVaultPosition(nx, ny, footprintW, footprintH);
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
    [cancelGlide, footprintW, footprintH],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || expanded) return;
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
      const c = clampVaultPosition(nx, ny, footprintW, footprintH);
      posRef.current = c;
      setPos((p) => (c.x !== p.x || c.y !== p.y ? c : p));
    },
    [footprintW, footprintH],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { vx, vy } = velocityRef.current;
      const wasTap = !dragCommittedRef.current;
      dragRef.current = null;
      setDragging(false);
      elRef.current?.releasePointerCapture(e.pointerId);
      if (wasTap && !expanded) {
        expandStack();
        return;
      }
      userMovedRef.current = true;
      startGlide(vx, vy);
    },
    [expanded, expandStack, startGlide],
  );

  useEffect(
    () => () => {
      cancelGlide();
      clearExpandTimer();
      clearBootTimer();
      stopScrollLoop();
    },
    [cancelGlide, clearBootTimer, clearExpandTimer, stopScrollLoop],
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
    if (!expanded || heroPose !== "scatter" || collapsingRef.current) {
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
  }, [expanded, heroPose]);

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
        scrollPosRef.current -=
          (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.8;
      } else {
        scrollPosRef.current -= e.deltaY * 0.8;
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
      scrollPosRef.current += delta * 2;
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
  }, [mobile, needsScroll, repPhase]);

  useLayoutEffect(() => {
    if (repPhase) {
      disposeRepCards(currentScrollRef.current);
    }
  }, [repPhase, layout, mobile, disposeRepCards]);

  const motionActive = dragging || gliding;
  const shellTransform = dragging ? "scale(1.02)" : undefined;
  const fanOriginX =
    footprintW / 2 - (CARTRIDGE_CARD_W * CARTRIDGE_FAN_SCALE) / 2;
  const fanOriginY =
    footprintH / 2 - (CARTRIDGE_CARD_H * CARTRIDGE_FAN_SCALE) / 2;
  const panelVisible = expanded && (repPhase || heroPose === "list");
  const showScrollFades = expanded && needsScroll;

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
        cursor: dragging ? "grabbing" : "grab",
        transform: shellTransform,
        transformOrigin: "center center",
        visibility: expanded ? "hidden" : "visible",
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
      {VAULT_CARTRIDGE_ITEMS.slice(0, CARTRIDGE_VISIBLE_FAN).map((item, i) => {
        const s = CARTRIDGE_SCATTER[i % CARTRIDGE_SCATTER.length]!;
        return (
          <div
            key={item.id}
            className="vault-cartridge-card"
            style={{
              left: fanOriginX + s.ox,
              top: fanOriginY + s.oy,
              transform: `rotate(${s.rotate}deg) scale(${CARTRIDGE_FAN_SCALE})`,
              zIndex: CARTRIDGE_VISIBLE_FAN - i,
              opacity: 1,
            }}
          >
            <CartridgeImage src={item.src} alt={item.alt} />
          </div>
        );
      })}
    </div>
  );

  const expandedOverlay = expanded ? (
    <div
      className="fixed inset-0 touch-none"
      style={{ zIndex: vaultOverlayZIndex(zIndex) }}
    >
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
            );
            const list = cartridgeExpandedXY(i, layout, mobile);
            const pose = heroPose === "list" ? list : scatter;
            const delay = heroMotion ? heroCartridgeTransitionDelay(i, heroPose) : 0;
            const opacity = heroPose === "list" ? 1 : scatter.opacity;
            return (
              <div
                key={item.id}
                className={`vault-cartridge-card${heroMotion ? "" : " vault-cartridge-card--hero-frozen"}`}
                style={{
                  position: "fixed",
                  left: pose.x,
                  top: pose.y,
                  transform: `rotate(${heroPose === "list" ? 0 : scatter.rotate}deg) scale(${heroPose === "list" ? 1 : scatter.scale})`,
                  zIndex: CARTRIDGE_COUNT - i,
                  opacity,
                  pointerEvents: collapsing ? "none" : "auto",
                  transitionDelay: heroMotion ? `${delay}ms` : "0ms",
                }}
              >
                <CartridgeImage src={item.src} alt={item.alt} />
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
                  transform: isSelected ? "scale(1.15)" : "scale(1)",
                  pointerEvents: "auto",
                }}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedCartridgeIdx(cardIdx);
                  playCartridgeVideo(cardIdx);
                }}
              >
                <CartridgeImage src={item.src} alt={item.alt} />
              </button>
            );
          })}
        </div>
      ) : null}

      {mobile ? (
        <>
          <div
            className={`vault-cartridge-fade vault-cartridge-fade--left${showScrollFades ? " vault-cartridge-fade--visible" : ""}`}
          />
          <div
            className={`vault-cartridge-fade vault-cartridge-fade--right${showScrollFades ? " vault-cartridge-fade--visible" : ""}`}
          />
        </>
      ) : (
        <>
          <div
            className={`vault-cartridge-fade vault-cartridge-fade--top${showScrollFades ? " vault-cartridge-fade--visible" : ""}`}
          />
          <div
            className={`vault-cartridge-fade vault-cartridge-fade--bottom${showScrollFades ? " vault-cartridge-fade--visible" : ""}`}
          />
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      {mounted ? createPortal(collapsedPile, document.body) : collapsedPile}
      {expanded && mounted
        ? createPortal(expandedOverlay, document.body)
        : expandedOverlay}
    </>
  );
}
