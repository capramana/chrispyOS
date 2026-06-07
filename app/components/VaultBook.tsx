"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "iconoir-react";
import { clampVaultDragPosition, clampVaultPosition, VAULT_BOOK_SIZE, VAULT_BOOK_SPINE_W, VAULT_OVERLAY_BACKDROP_BUTTON_CLASS, vaultBookOpenLayout, vaultOverlayBackdropStyle, vaultOverlayZIndex } from "./vaultRects";
import {
  VAULT_BOOK_CHAPTERS,
  VAULT_BOOK_PAPER_TEXTURE,
  VAULT_BOOK_STAMP,
} from "./vaultBookChapters";
import { useClientMounted } from "./useClientMounted";
import "./VaultBook.css";

type VaultBookProps = {
  id: string;
  zIndex: number;
  onInteractionStart: (id: string) => void;
  initialLeft: number;
  initialTop: number;
  footprintW: number;
  footprintH: number;
  closedScale: number;
  openScale: number;
};

const TILT_MAX = 2;
const TAP_MOVE_THRESHOLD_PX = 8;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;

function randomSpawnRotation() {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (10 + Math.random() * 5);
}

function openBookLayout(
  footprintW: number,
  footprintH: number,
) {
  return vaultBookOpenLayout(
    window.innerWidth,
    window.innerHeight,
    footprintW,
    footprintH,
  );
}

function posFromAnchor(cx: number, cy: number, w: number, h: number) {
  return { x: cx - w / 2, y: cy - h / 2 };
}

function anchorFromPos(x: number, y: number, w: number, h: number) {
  return { cx: x + w / 2, cy: y + h / 2 };
}

export default function VaultBook({
  id,
  zIndex,
  onInteractionStart,
  initialLeft,
  initialTop,
  footprintW,
  footprintH,
  closedScale,
  openScale,
}: VaultBookProps) {
  const [pos, setPos] = useState(() =>
    posFromAnchor(initialLeft, initialTop, footprintW, footprintH),
  );
  const [tiltDeg, setTiltDeg] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [open, setOpen] = useState(false);
  const [animBusy, setAnimBusy] = useState(false);
  const [backdropEntered, setBackdropEntered] = useState(false);
  const [restRotDeg] = useState(() => randomSpawnRotation());
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
  const closedAnchorRef = useRef(anchorFromPos(pos.x, pos.y, footprintW, footprintH));
  const userMovedRef = useRef(false);
  const suppressCloseClickRef = useRef(false);
  const animBusyTimeoutRef = useRef<number | null>(null);
  const suppressCloseClickTimeoutRef = useRef<number | null>(null);

  const clearAnimBusyTimeout = () => {
    if (animBusyTimeoutRef.current !== null) {
      window.clearTimeout(animBusyTimeoutRef.current);
      animBusyTimeoutRef.current = null;
    }
  };

  const clearSuppressCloseClickTimeout = () => {
    if (suppressCloseClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressCloseClickTimeoutRef.current);
      suppressCloseClickTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useLayoutEffect(() => {
    if (open || userMovedRef.current) return;
    const next = posFromAnchor(initialLeft, initialTop, footprintW, footprintH);
    closedAnchorRef.current = { cx: initialLeft, cy: initialTop };
    posRef.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync anchor when parent spawn updates
    setPos(next);
  }, [initialLeft, initialTop, footprintW, footprintH, open]);

  const storeClosedAnchor = useCallback(
    (userMoved = false) => {
      closedAnchorRef.current = anchorFromPos(
        posRef.current.x,
        posRef.current.y,
        footprintW,
        footprintH,
      );
      if (userMoved) userMovedRef.current = true;
    },
    [footprintW, footprintH],
  );

  const restoreClosedPosition = useCallback(() => {
    const next = posFromAnchor(
      closedAnchorRef.current.cx,
      closedAnchorRef.current.cy,
      footprintW,
      footprintH,
    );
    const c = clampVaultPosition(next.x, next.y, footprintW, footprintH);
    closedAnchorRef.current = anchorFromPos(c.x, c.y, footprintW, footprintH);
    sizeRef.current = { w: footprintW, h: footprintH };
    posRef.current = c;
    setPos(c);
  }, [footprintW, footprintH]);

  const cancelGlide = useCallback(() => {
    if (glideRafRef.current !== null) {
      cancelAnimationFrame(glideRafRef.current);
      glideRafRef.current = null;
    }
    setGliding(false);
  }, []);

  const openBook = useCallback(() => {
    if (animBusy || open) return;
    setAnimBusy(true);
    storeClosedAnchor(true);
    setBackdropEntered(false);
    const layout = openBookLayout(footprintW, footprintH);
    sizeRef.current = { w: footprintW, h: footprintH };
    clearSuppressCloseClickTimeout();
    suppressCloseClickRef.current = true;
    suppressCloseClickTimeoutRef.current = window.setTimeout(() => {
      suppressCloseClickRef.current = false;
      suppressCloseClickTimeoutRef.current = null;
    }, 400);
    setOpen(true);
    requestAnimationFrame(() => {
      posRef.current = { x: layout.x, y: layout.y };
      setPos({ x: layout.x, y: layout.y });
    });
    clearAnimBusyTimeout();
    animBusyTimeoutRef.current = window.setTimeout(() => {
      setAnimBusy(false);
      animBusyTimeoutRef.current = null;
    }, 900);
  }, [animBusy, open, storeClosedAnchor, footprintW, footprintH]);

  const closeBook = useCallback(() => {
    if (!open) return;
    setAnimBusy(true);
    setBackdropEntered(false);
    setOpen(false);
    requestAnimationFrame(() => {
      restoreClosedPosition();
    });
    clearAnimBusyTimeout();
    animBusyTimeoutRef.current = window.setTimeout(() => {
      setAnimBusy(false);
      animBusyTimeoutRef.current = null;
    }, 900);
  }, [open, restoreClosedPosition]);

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
        const c = clampVaultDragPosition(nx, ny, w, h);
        if (c.x !== nx) gvx = 0;
        if (c.y !== ny) gvy = 0;
        gvx *= friction;
        gvy *= friction;
        posRef.current = c;
        setPos(c);

        setTiltDeg(Math.max(-TILT_MAX, Math.min(TILT_MAX, gvx * 0.028)));

        if (Math.hypot(gvx, gvy) < GLIDE_STOP) {
          glideRafRef.current = null;
          setGliding(false);
          setTiltDeg(0);
          storeClosedAnchor(true);
          return;
        }

        glideRafRef.current = requestAnimationFrame(tick);
      };

      glideRafRef.current = requestAnimationFrame(tick);
    },
    [cancelGlide, storeClosedAnchor],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || open) return;
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
    [cancelGlide, id, onInteractionStart, open],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
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
    const c = clampVaultDragPosition(nx, ny, d.width, d.height);
    posRef.current = c;
    setPos((p) => (c.x !== p.x || c.y !== p.y ? c : p));

    setTiltDeg(
      Math.max(-TILT_MAX, Math.min(TILT_MAX, velocityRef.current.vx * 0.042)),
    );
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { vx, vy } = velocityRef.current;
      const wasTap = !dragCommittedRef.current;
      dragRef.current = null;
      setDragging(false);
      elRef.current?.releasePointerCapture(e.pointerId);
      if (wasTap) {
        openBook();
        return;
      }
      storeClosedAnchor(true);
      startGlide(vx, vy);
    },
    [startGlide, openBook, storeClosedAnchor],
  );

  useEffect(
    () => () => {
      cancelGlide();
      clearAnimBusyTimeout();
      clearSuppressCloseClickTimeout();
    },
    [cancelGlide],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const applyOpenLayout = () => {
      const layout = openBookLayout(footprintW, footprintH);
      sizeRef.current = { w: footprintW, h: footprintH };
      posRef.current = { x: layout.x, y: layout.y };
      setPos({ x: layout.x, y: layout.y });
    };
    applyOpenLayout();
    window.addEventListener("resize", applyOpenLayout);
    return () => window.removeEventListener("resize", applyOpenLayout);
  }, [open, footprintW, footprintH, openScale]);

  useEffect(() => {
    if (open) return;
    const onResize = () => {
      const next = posFromAnchor(
        closedAnchorRef.current.cx,
        closedAnchorRef.current.cy,
        footprintW,
        footprintH,
      );
      const c = clampVaultPosition(next.x, next.y, footprintW, footprintH);
      sizeRef.current = { w: footprintW, h: footprintH };
      if (c.x === posRef.current.x && c.y === posRef.current.y) return;
      posRef.current = c;
      setPos(c);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, footprintW, footprintH]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeBook();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeBook]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const motionActive = dragging || gliding;
  const positionAnimating = open || animBusy;
  const shellRotDeg = open ? 0 : restRotDeg + tiltDeg;
  const shellTransform = `rotate(${shellRotDeg.toFixed(2)}deg) scale(${dragging ? 1.02 : 1})`;
  const shellTransition = motionActive
    ? "none"
    : positionAnimating
      ? "left 0.8s cubic-bezier(0.45, 0, 0.55, 1), top 0.8s cubic-bezier(0.45, 0, 0.55, 1), transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)"
      : "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";
  const overlayActive = open || animBusy;
  const paperStyle = {
    "--vault-book-paper-texture": `url("${VAULT_BOOK_PAPER_TEXTURE}")`,
  } as React.CSSProperties;

  const shellStyle = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    width: footprintW,
    height: footprintH,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    zIndex: overlayActive ? undefined : zIndex,
    cursor: open ? "default" : dragging ? "grabbing" : "grab",
    transform: shellTransform,
    transformOrigin: "center center",
    transition: shellTransition,
    "--vault-book-spine-w": `${VAULT_BOOK_SPINE_W}px`,
    "--vault-book-h": `${VAULT_BOOK_SIZE.h}px`,
  } as React.CSSProperties;

  const bookShell = (
    <div
      ref={elRef}
      data-spawn-peer={id}
      className="vault-book-root vault-artifact touch-none select-none outline-none focus:outline-none"
      style={shellStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <motion.div
        className={open ? "vault-book vault-book--open" : "vault-book"}
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: open ? "0% 50%" : "center center",
        }}
        initial={{ scale: closedScale }}
        animate={{ scale: open ? openScale : closedScale }}
        transition={{
          scale: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        }}
        onClick={
          open
            ? (e) => {
                if (suppressCloseClickRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                closeBook();
              }
            : undefined
        }
      >
        <div
          className="vault-book__page vault-book__cover vault-book__cover--back"
          style={{
            zIndex: 1,
            transform: "translate(0, -50%) translateZ(-1px)",
            background: "var(--vault-book-spine)",
          }}
        >
          <div
            className="vault-book__half vault-book__half--front"
            style={{ background: "var(--vault-book-spine)" }}
          />
          <div
            className="vault-book__half vault-book__half--back"
            style={{ background: "var(--vault-book-spine)" }}
          />
        </div>

        <motion.div
          className="vault-book__page vault-book__page--inner"
          style={{ zIndex: 4 }}
          initial={{ z: -1 }}
          animate={{ z: open ? 1 : -1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="vault-book__half vault-book__half--front vault-book-paper overflow-hidden"
            style={{
              ...paperStyle,
              borderRadius: "0 8px 8px 0",
            }}
          >
            <div className="absolute inset-0 flex h-full w-full flex-col justify-between px-6 pb-6 pt-8 font-mono text-[#040404]">
              <div className="flex flex-col gap-2">
                <div className="text-[13px] font-medium leading-3">Table of Contents</div>
              </div>
              <div className="flex flex-col gap-3">
                {VAULT_BOOK_CHAPTERS.map((chapter) => (
                  <div key={chapter.number} className="flex flex-col gap-0">
                    <div className="flex gap-3">
                      <div className="text-[8px] font-medium leading-3">{chapter.number}</div>
                      <div className="text-[8px] font-light leading-3">{chapter.title}</div>
                    </div>
                    <div className="flex flex-col pl-[15px]">
                      {chapter.subchapters.map((sub) => (
                        <a
                          key={sub.href}
                          href={sub.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vault-book-subchapter"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[#6d6d6d]">{sub.label}</span>
                          <span>{sub.title}</span>
                          <ArrowUpRight
                            className="vault-book-subchapter__arrow"
                            width={8}
                            height={8}
                            strokeWidth={2}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="vault-book__half vault-book__half--back" />
        </motion.div>

        <motion.div
          className="vault-book__page vault-book__cover vault-book__cover--front"
          style={{
            zIndex: 6,
            top: "50%",
            background: "var(--vault-book-spine)",
            transformStyle: "preserve-3d",
          }}
          initial={{ rotateY: 0, z: 13, y: "-50%" }}
          animate={{
            rotateY: open ? -180 : 0,
            z: open ? -1 : 13,
            y: "-50%",
          }}
          transition={{ duration: 0.8, ease: [0.45, 0, 0.55, 1] }}
        >
          <div className="vault-book__half vault-book__half--front">
            <div className="vault-book__spine" aria-hidden />
            <div className="vault-book-cover-gradient">
              <div className="absolute left-[25px] top-[18px] flex flex-col gap-2">
                <div className="h-1 w-[5.5vmin] shrink-0 bg-[#fdf7e7]" />
                <div className="text-xs font-semibold leading-snug text-[#fdf7e7]">
                  Cerebral Processor &amp; Memories
                  <br />
                  Operational Guide
                </div>
              </div>
              <div className="absolute left-[25px] top-[194px] text-xl font-semibold leading-tight text-[#fdf7e7]">
                Operational
                <br />
                Guide
              </div>
              <div className="absolute bottom-[43px] left-[25px] text-xs font-semibold text-[#fdf7e7]">
                CP-0704-01
              </div>
            </div>
          </div>
          <div
            className="vault-book__half vault-book__half--back vault-book-paper overflow-hidden"
            style={{
              ...paperStyle,
              background: "var(--vault-book-spine)",
            }}
          >
            <div
              className="vault-book-paper absolute bottom-1 left-1 right-0 top-1 overflow-hidden rounded-l-lg"
              style={paperStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={VAULT_BOOK_STAMP}
                alt=""
                className="absolute right-6 top-6 w-[79px] rotate-[-8deg] opacity-90"
              />
              <div className="absolute bottom-6 left-6 flex max-w-[160px] flex-col items-start gap-2 font-mono text-[6px] font-light leading-2 text-[#040404]">
                <div>
                  Cerebral Processor &amp; Memories Operational Guide
                  <br />
                  &copy; 2001 by The Board of Trustees of Generational Partners
                </div>
                <div>All rights reserved.</div>
                <div>
                  Published in the United States of America
                  <br />
                  by Humane Institute on LED
                </div>
                <div>
                  Generational Partners
                  <br />
                  New York, NY
                  <br />
                  chrispramana.com
                </div>
                <div>
                  ISBN: 628-3-185307-17-9
                  <br />
                  Library of Congress Control Number: 42069
                  <br />
                  First Edition
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );

  const layerZ = overlayActive ? vaultOverlayZIndex(zIndex) : zIndex;

  const portalContent = (
    <div
      className={overlayActive ? "fixed inset-0 touch-none" : undefined}
      style={
        overlayActive
          ? { zIndex: layerZ, pointerEvents: "none" }
          : undefined
      }
    >
      {open && (
        <button
          type="button"
          className={VAULT_OVERLAY_BACKDROP_BUTTON_CLASS}
          style={{
            ...vaultOverlayBackdropStyle(backdropEntered),
            pointerEvents: "auto",
          }}
          aria-label="Close book"
          onClick={closeBook}
        />
      )}
      <div style={{ pointerEvents: "auto" }}>{bookShell}</div>
    </div>
  );

  if (!mounted) return bookShell;

  return createPortal(portalContent, document.body);
}
