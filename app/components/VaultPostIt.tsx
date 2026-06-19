"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  clampVaultDragPosition,
  clampVaultPosition,
  VAULT_OVERLAY_BACKDROP_BUTTON_CLASS,
  vaultOverlayBackdropStyle,
  vaultOverlayZIndex,
} from "./vaultRects";
import { useClientMounted } from "./useClientMounted";
import {
  fitPostItFonts,
  VAULT_POSTIT_BASE_PADDING,
  VAULT_POSTIT_COLLAPSED,
  vaultPostItExpandLayout,
} from "./vaultPostItLayout";
import { pickVaultPostItQuote } from "./vaultPostItQuotes";
import { useVaultSpawnEnter, VAULT_SPAWN_ENTER_TRANSITION } from "./vaultSpawnEnter";
import "./VaultPostIt.css";

type VaultPostItProps = {
  id: string;
  zIndex: number;
  onInteractionStart: (id: string) => void;
  initialLeft: number;
  initialTop: number;
  footprintW: number;
  footprintH: number;
  noteSize: number;
  expandedSize: number;
};

const TILT_MAX = 2;
const TAP_MOVE_THRESHOLD_PX = 8;
const GLIDE_SPEED_MIN = 0.22;
const GLIDE_VELOCITY_SCALE = 0.38;
const GLIDE_VELOCITY_CAP = 0.28;
const FRICTION_PER_MS = 0.0052;
const GLIDE_STOP = 0.1;
const EXPAND_MS = 400;
const HOVER_SCALE = 1.04;
const HOVER_LIFT_PX = -5;
const HOVER_ROT_MUL = 0.4;
const POSTIT_HOVER_TRANSITION =
  "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease";

function randomRestRotation() {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (2 + Math.random() * 3);
}

function posFromAnchor(cx: number, cy: number, w: number, h: number) {
  return { x: cx - w / 2, y: cy - h / 2 };
}

function anchorFromPos(x: number, y: number, w: number, h: number) {
  return { cx: x + w / 2, cy: y + h / 2 };
}

function paddingForSize(noteSize: number) {
  return VAULT_POSTIT_BASE_PADDING * (noteSize / VAULT_POSTIT_COLLAPSED);
}

function collapsedShellPos(
  footprintX: number,
  footprintY: number,
  footprintW: number,
  footprintH: number,
  shellSize: number,
) {
  return {
    left: footprintX + (footprintW - shellSize) / 2,
    top: footprintY + (footprintH - shellSize) / 2,
  };
}

export default function VaultPostIt({
  id,
  zIndex,
  onInteractionStart,
  initialLeft,
  initialTop,
  footprintW,
  footprintH,
  noteSize,
  expandedSize,
}: VaultPostItProps) {
  const [quote] = useState(() => pickVaultPostItQuote());
  const [footprintPos, setFootprintPos] = useState(() =>
    posFromAnchor(initialLeft, initialTop, footprintW, footprintH),
  );
  const [shellSize, setShellSize] = useState(noteSize);
  const [paddingPx, setPaddingPx] = useState(() => paddingForSize(noteSize));
  const fontFit = useMemo(
    () => fitPostItFonts(quote.text, quote.author, shellSize, paddingPx),
    [quote.author, quote.text, shellSize, paddingPx],
  );
  const [dragging, setDragging] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tapPending, setTapPending] = useState(false);
  const [tiltDeg, setTiltDeg] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const [layoutOpening, setLayoutOpening] = useState(false);
  const [backdropEntered, setBackdropEntered] = useState(false);
  const [restRotDeg] = useState(() => randomRestRotation());
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
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const glideRafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const footprintPosRef = useRef(footprintPos);
  const closedAnchorRef = useRef(
    anchorFromPos(footprintPos.x, footprintPos.y, footprintW, footprintH),
  );
  const layoutTimerRef = useRef<number | null>(null);

  const clearLayoutTimer = useCallback(() => {
    if (layoutTimerRef.current !== null) {
      window.clearTimeout(layoutTimerRef.current);
      layoutTimerRef.current = null;
    }
  }, []);

  const cancelGlide = useCallback(() => {
    if (glideRafRef.current !== null) {
      cancelAnimationFrame(glideRafRef.current);
      glideRafRef.current = null;
    }
    setGliding(false);
  }, []);

  const storeClosedAnchor = useCallback(() => {
    closedAnchorRef.current = anchorFromPos(
      footprintPosRef.current.x,
      footprintPosRef.current.y,
      footprintW,
      footprintH,
    );
  }, [footprintH, footprintW]);

  const footprintFromShell = useCallback(
    (shellLeft: number, shellTop: number) => ({
      x: shellLeft - (footprintW - noteSize) / 2,
      y: shellTop - (footprintH - noteSize) / 2,
    }),
    [footprintH, footprintW, noteSize],
  );

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

        const p = footprintPosRef.current;
        const nx = p.x + gvx * dtMs;
        const ny = p.y + gvy * dtMs;
        const c = clampVaultDragPosition(nx, ny, footprintW, footprintH);
        if (c.x !== nx) gvx = 0;
        if (c.y !== ny) gvy = 0;
        gvx *= Math.exp(-FRICTION_PER_MS * dtMs);
        gvy *= Math.exp(-FRICTION_PER_MS * dtMs);
        footprintPosRef.current = c;
        setFootprintPos(c);

        setTiltDeg(Math.max(-TILT_MAX, Math.min(TILT_MAX, gvx * 0.028)));

        if (Math.hypot(gvx, gvy) < GLIDE_STOP) {
          glideRafRef.current = null;
          setGliding(false);
          setTiltDeg(0);
          storeClosedAnchor();
          return;
        }

        glideRafRef.current = requestAnimationFrame(tick);
      };

      glideRafRef.current = requestAnimationFrame(tick);
    },
    [cancelGlide, footprintH, footprintW, storeClosedAnchor],
  );

  const runLayoutAnimation = useCallback(
    (opening: boolean, applyTarget: () => void) => {
      clearLayoutTimer();
      cancelGlide();
      setLayoutOpening(opening);
      setLayoutAnimating(true);
      if (opening) setExpanded(true);
      else setBackdropEntered(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyTarget();
        });
      });

      layoutTimerRef.current = window.setTimeout(() => {
        layoutTimerRef.current = null;
        setLayoutAnimating(false);
        if (!opening) setExpanded(false);
      }, EXPAND_MS);
    },
    [cancelGlide, clearLayoutTimer],
  );

  const collapse = useCallback(() => {
    runLayoutAnimation(false, () => {
      const next = posFromAnchor(
        closedAnchorRef.current.cx,
        closedAnchorRef.current.cy,
        footprintW,
        footprintH,
      );
      const c = clampVaultPosition(next.x, next.y, footprintW, footprintH);
      footprintPosRef.current = c;
      setFootprintPos(c);
      setShellSize(noteSize);
      setPaddingPx(paddingForSize(noteSize));
    });
  }, [footprintH, footprintW, noteSize, runLayoutAnimation]);

  const expand = useCallback(() => {
    storeClosedAnchor();
    runLayoutAnimation(true, () => {
      const layout = vaultPostItExpandLayout(
        window.innerWidth,
        window.innerHeight,
        expandedSize,
      );
      const c = clampVaultPosition(layout.x, layout.y, expandedSize, expandedSize);
      footprintPosRef.current = c;
      setFootprintPos(c);
      setShellSize(expandedSize);
      setPaddingPx(paddingForSize(expandedSize));
    });
  }, [expandedSize, runLayoutAnimation, storeClosedAnchor]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || expanded || layoutAnimating) return;
      const el = elRef.current;
      if (!el) return;
      cancelGlide();
      const rect = el.getBoundingClientRect();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      dragCommittedRef.current = false;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      dragRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: footprintW,
        height: footprintH,
      };
      velocityRef.current = { vx: 0, vy: 0 };
      const t = performance.now();
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: t };
      setDragging(true);
      setTapPending(true);
      setTiltDeg(0);
      onInteractionStart(id);
    },
    [cancelGlide, expanded, footprintH, footprintW, id, layoutAnimating, onInteractionStart],
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

      const shellLeft = e.clientX - d.offsetX;
      const shellTop = e.clientY - d.offsetY;
      const { x: footprintX, y: footprintY } = footprintFromShell(shellLeft, shellTop);
      const c = clampVaultDragPosition(footprintX, footprintY, d.width, d.height);
      footprintPosRef.current = c;
      setFootprintPos((p) => (c.x !== p.x || c.y !== p.y ? c : p));

      setTiltDeg(
        Math.max(-TILT_MAX, Math.min(TILT_MAX, velocityRef.current.vx * 0.042)),
      );
    },
    [footprintFromShell],
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
      if (wasTap) {
        expand();
        return;
      }
      storeClosedAnchor();
      startGlide(vx, vy);
    },
    [expand, startGlide, storeClosedAnchor],
  );

  useEffect(() => {
    if (!expanded) return;
    const applyLayout = () => {
      const layout = vaultPostItExpandLayout(
        window.innerWidth,
        window.innerHeight,
        expandedSize,
      );
      const c = clampVaultPosition(layout.x, layout.y, expandedSize, expandedSize);
      footprintPosRef.current = c;
      setFootprintPos(c);
    };
    window.addEventListener("resize", applyLayout);
    return () => window.removeEventListener("resize", applyLayout);
  }, [expanded, expandedSize]);

  useEffect(() => {
    if (expanded) return;
    const onResize = () => {
      const next = posFromAnchor(
        closedAnchorRef.current.cx,
        closedAnchorRef.current.cy,
        footprintW,
        footprintH,
      );
      const c = clampVaultPosition(next.x, next.y, footprintW, footprintH);
      if (c.x === footprintPosRef.current.x && c.y === footprintPosRef.current.y) {
        return;
      }
      footprintPosRef.current = c;
      setFootprintPos(c);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded, footprintH, footprintW]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapse, expanded]);

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (alive) setBackdropEntered(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [expanded]);

  useEffect(
    () => () => {
      cancelGlide();
      clearLayoutTimer();
    },
    [cancelGlide, clearLayoutTimer],
  );

  const expandedLayout = shellSize > noteSize + 0.5;
  const shellPos = expandedLayout
    ? { left: footprintPos.x, top: footprintPos.y }
    : collapsedShellPos(
        footprintPos.x,
        footprintPos.y,
        footprintW,
        footprintH,
        shellSize,
      );

  const motionActive = dragging || gliding;
  const hoverAffordance = hovered || tapPending;
  const hoverLift =
    hoverAffordance && !expanded && !layoutAnimating && !gliding && spawnEntered;
  const overlayActive = expanded || layoutAnimating;

  let shellRotDeg = 0;
  if (
    spawnEntered &&
    !(expanded && !layoutAnimating) &&
    !(layoutAnimating && layoutOpening)
  ) {
    shellRotDeg = (hoverLift ? restRotDeg * HOVER_ROT_MUL : restRotDeg) + tiltDeg;
  }

  let shellScale = 0.88;
  if (spawnEntered) {
    if (dragging && !tapPending) shellScale = 1.02;
    else if (hoverLift) shellScale = HOVER_SCALE;
    else shellScale = 1;
  }

  const shellLiftPx = hoverLift ? HOVER_LIFT_PX : 0;
  const suppressTransition = gliding || (dragging && !tapPending);
  const shellTransition = suppressTransition
    ? "none"
    : layoutAnimating
      ? undefined
      : !spawnEntered
        ? "none"
        : spawnSettled
          ? POSTIT_HOVER_TRANSITION
          : VAULT_SPAWN_ENTER_TRANSITION;

  const layerZ = overlayActive ? vaultOverlayZIndex(zIndex) : zIndex;

  const note = (
    <div
      ref={elRef}
      data-spawn-peer={id}
      className={[
        "vault-postit vault-artifact touch-none select-none text-left outline-none focus:outline-none",
        layoutAnimating ? "vault-postit--transitioning" : "",
        expandedLayout ? "vault-postit--expanded" : "",
        hoverLift ? "vault-postit--hover" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "fixed",
        left: shellPos.left,
        top: shellPos.top,
        width: shellSize,
        height: shellSize,
        padding: paddingPx,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        zIndex: overlayActive ? undefined : zIndex,
        cursor: expanded ? "pointer" : motionActive ? "grabbing" : "grab",
        opacity: spawnEntered ? 1 : 0,
        pointerEvents: spawnEntered ? "auto" : "none",
        transform: `translateY(${shellLiftPx}px) rotate(${shellRotDeg.toFixed(2)}deg) scale(${shellScale})`,
        transformOrigin: "center center",
        transition: shellTransition,
      }}
      onPointerEnter={() => {
        if (!expanded && !layoutAnimating && !gliding) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onClick={expandedLayout && !layoutAnimating ? collapse : undefined}
    >
      <div className="w-full">
        <p
          className="vault-postit__quote"
          style={{ fontSize: fontFit.quotePx }}
        >
          {quote.text}
        </p>
        <p
          className="vault-postit__attribution"
          style={{ fontSize: fontFit.attributionPx }}
        >
          {quote.author}
        </p>
      </div>
    </div>
  );

  const portalContent = (
    <div
      className={overlayActive ? "fixed inset-0 touch-none" : undefined}
      style={
        overlayActive
          ? { zIndex: layerZ, pointerEvents: "none" }
          : undefined
      }
    >
      {expanded && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close post-it"
          className={VAULT_OVERLAY_BACKDROP_BUTTON_CLASS}
          style={{
            ...vaultOverlayBackdropStyle(backdropEntered),
            pointerEvents: "auto",
          }}
          onClick={collapse}
        />
      )}
      <div style={{ pointerEvents: "auto" }}>{note}</div>
    </div>
  );

  if (!mounted) return note;

  return createPortal(portalContent, document.body);
}
