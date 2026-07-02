"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatGuestBookHandleDisplay, guestBookDrawingById } from "@/lib/memento/guestBookPages";
import type { GuestBookPageContent } from "@/lib/memento/guestBookPages";
import {
  anchorPositionKey,
  buildDrawingHoverTarget,
  drawingElementUnderPoint,
  profilePosition,
  refreshDrawingHoverTarget,
  type GuestBookDrawingHoverTarget,
} from "@/lib/memento/guestBookDrawingDom";
import {
  GUEST_BOOK_HOVER_DELAY_MS,
  GUEST_BOOK_HOVER_FADE_OUT_MS,
  clearGuestBookTimeoutRef,
  type GuestBookSearchProfilePin,
} from "@/lib/memento/guestBookSearch";
import { mementoAvatarUrl } from "@/lib/memento/mementoAvatarUrl";
import "./GuestBook.css";

export type { GuestBookDrawingHoverTarget };

const GUEST_BOOK_HOVER_LEAVE_GRACE_MS = 80;

function searchProfileCardOpacity(
  pinned: boolean,
  fadingOut: boolean,
  fadeOpacity: number | null,
  hover: GuestBookDrawingHoverTarget,
  drawingOpacity: number,
): number | undefined {
  if (!pinned) return drawingOpacity;
  if (fadingOut) return 0;
  if (fadeOpacity !== null) return fadeOpacity;
  if (hover.fadeIn) return undefined;
  return 1;
}

export function GuestBookHoverProvider({
  children,
  opacityFor,
  spreadRef,
  measureSpread,
  spreadOpen,
  animating = false,
  step,
  leftPageNum,
  rightPageNum,
  searchProfilePin,
  searchProfileFadingOut,
  searchProfileCssFadeIn,
  searchProfileFadeOpacity,
  pages,
}: {
  children: React.ReactNode;
  opacityFor: (drawingId: string, pageNumber: number) => number;
  spreadRef: React.RefObject<HTMLDivElement | null>;
  measureSpread: () => DOMRect | null;
  spreadOpen: boolean;
  animating?: boolean;
  step: number;
  leftPageNum: number;
  rightPageNum: number;
  searchProfilePin: GuestBookSearchProfilePin | null;
  searchProfileFadingOut: boolean;
  searchProfileCssFadeIn: boolean;
  searchProfileFadeOpacity: number | null;
  pages: GuestBookPageContent[];
}) {
  const [mouseHover, setMouseHover] = useState<GuestBookDrawingHoverTarget | null>(
    null,
  );
  const [mouseHoverExit, setMouseHoverExit] =
    useState<GuestBookDrawingHoverTarget | null>(null);
  const [searchProfileHover, setSearchProfileHover] =
    useState<GuestBookDrawingHoverTarget | null>(null);
  const mouseHoverRef = useRef<GuestBookDrawingHoverTarget | null>(null);
  const mouseHoverExitTimerRef = useRef<number | null>(null);
  const hoverDelayTimerRef = useRef<number | null>(null);
  const pendingDrawingIdRef = useRef<string | null>(null);
  const shownDrawingIdRef = useRef<string | null>(null);
  const spreadHoverRevealedRef = useRef(false);
  const pendingTargetRef = useRef<GuestBookDrawingHoverTarget | null>(null);
  const dismissSessionTimerRef = useRef<number | null>(null);
  const leaveGraceTimerRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const probeHoverAtRef = useRef<((x: number, y: number) => void) | null>(null);
  const prevAnimatingRef = useRef(animating);
  const searchProfilePinned = searchProfilePin !== null;

  const commitMouseHover = useCallback(
    (target: GuestBookDrawingHoverTarget | null) => {
      mouseHoverRef.current = target;
      setMouseHover(target);
    },
    [],
  );

  const clearMouseHoverExit = useCallback(() => {
    if (mouseHoverExitTimerRef.current !== null) {
      window.clearTimeout(mouseHoverExitTimerRef.current);
      mouseHoverExitTimerRef.current = null;
    }
    setMouseHoverExit(null);
  }, []);

  const startMouseHoverExit = useCallback(
    (target: GuestBookDrawingHoverTarget) => {
      clearMouseHoverExit();
      setMouseHoverExit(target);
      mouseHoverExitTimerRef.current = window.setTimeout(() => {
        mouseHoverExitTimerRef.current = null;
        setMouseHoverExit(null);
      }, GUEST_BOOK_HOVER_FADE_OUT_MS);
    },
    [clearMouseHoverExit],
  );

  const setHoverWithFade = useCallback(
    (target: GuestBookDrawingHoverTarget | null) => {
      if (target) {
        const current = mouseHoverRef.current;
        if (current?.drawing.id === target.drawing.id) {
          commitMouseHover(target);
          return;
        }
        if (current && current.drawing.id !== target.drawing.id) {
          startMouseHoverExit(current);
        }
        commitMouseHover(target);
        return;
      }

      const current = mouseHoverRef.current;
      if (!current) {
        commitMouseHover(null);
        return;
      }

      startMouseHoverExit(current);
      commitMouseHover(null);
    },
    [commitMouseHover, startMouseHoverExit],
  );

  const clearHoverImmediately = useCallback(() => {
    if (hoverDelayTimerRef.current !== null) {
      window.clearTimeout(hoverDelayTimerRef.current);
      hoverDelayTimerRef.current = null;
    }
    if (dismissSessionTimerRef.current !== null) {
      window.clearTimeout(dismissSessionTimerRef.current);
      dismissSessionTimerRef.current = null;
    }
    if (leaveGraceTimerRef.current !== null) {
      window.clearTimeout(leaveGraceTimerRef.current);
      leaveGraceTimerRef.current = null;
    }
    pendingDrawingIdRef.current = null;
    pendingTargetRef.current = null;
    shownDrawingIdRef.current = null;
    spreadHoverRevealedRef.current = false;
    clearMouseHoverExit();
    commitMouseHover(null);
  }, [clearMouseHoverExit, commitMouseHover]);

  useEffect(() => {
    return () => {
      clearHoverImmediately();
    };
  }, [step, spreadOpen, clearHoverImmediately]);

  useEffect(() => {
    const wasAnimating = prevAnimatingRef.current;
    prevAnimatingRef.current = animating;
    if (
      wasAnimating &&
      !animating &&
      spreadOpen &&
      !searchProfilePinned
    ) {
      const ptr = lastPointerRef.current;
      if (ptr) probeHoverAtRef.current?.(ptr.x, ptr.y);
    }
  }, [animating, spreadOpen, searchProfilePinned]);

  useEffect(
    () => () => {
      if (mouseHoverExitTimerRef.current !== null) {
        window.clearTimeout(mouseHoverExitTimerRef.current);
        mouseHoverExitTimerRef.current = null;
      }
      setMouseHoverExit(null);
    },
    [],
  );

  useEffect(() => {
    if (!spreadOpen || searchProfilePinned || animating) return;

    shownDrawingIdRef.current = null;
    spreadHoverRevealedRef.current = false;
    pendingDrawingIdRef.current = null;
    pendingTargetRef.current = null;
    clearGuestBookTimeoutRef(hoverDelayTimerRef);
    clearGuestBookTimeoutRef(dismissSessionTimerRef);
    clearGuestBookTimeoutRef(leaveGraceTimerRef);

    const allowedPages = new Set([leftPageNum, rightPageNum]);

    const buildTarget = (el: HTMLElement) =>
      buildDrawingHoverTarget(el, allowedPages, pages, measureSpread);

    const clearShownSessionLater = () => {
      if (dismissSessionTimerRef.current !== null) {
        window.clearTimeout(dismissSessionTimerRef.current);
      }
      dismissSessionTimerRef.current = window.setTimeout(() => {
        dismissSessionTimerRef.current = null;
        shownDrawingIdRef.current = null;
        spreadHoverRevealedRef.current = false;
      }, GUEST_BOOK_HOVER_FADE_OUT_MS);
    };

    const clearHover = () => {
      if (leaveGraceTimerRef.current !== null) {
        window.clearTimeout(leaveGraceTimerRef.current);
        leaveGraceTimerRef.current = null;
      }
      if (hoverDelayTimerRef.current !== null) {
        window.clearTimeout(hoverDelayTimerRef.current);
        hoverDelayTimerRef.current = null;
      }
      pendingDrawingIdRef.current = null;
      pendingTargetRef.current = null;
      if (shownDrawingIdRef.current !== null) {
        clearShownSessionLater();
      }
      setHoverWithFade(null);
    };

    const scheduleClearHover = () => {
      if (leaveGraceTimerRef.current !== null) return;
      leaveGraceTimerRef.current = window.setTimeout(() => {
        leaveGraceTimerRef.current = null;
        clearHover();
      }, GUEST_BOOK_HOVER_LEAVE_GRACE_MS);
    };

    const showHover = (
      target: GuestBookDrawingHoverTarget,
      fadeIn = false,
    ) => {
      if (dismissSessionTimerRef.current !== null) {
        window.clearTimeout(dismissSessionTimerRef.current);
        dismissSessionTimerRef.current = null;
      }
      shownDrawingIdRef.current = target.drawing.id;
      if (fadeIn) spreadHoverRevealedRef.current = true;
      setHoverWithFade(fadeIn ? { ...target, fadeIn: true } : target);
    };

    const switchHover = (target: GuestBookDrawingHoverTarget) => {
      if (leaveGraceTimerRef.current !== null) {
        window.clearTimeout(leaveGraceTimerRef.current);
        leaveGraceTimerRef.current = null;
      }
      if (hoverDelayTimerRef.current !== null) {
        window.clearTimeout(hoverDelayTimerRef.current);
        hoverDelayTimerRef.current = null;
      }
      pendingDrawingIdRef.current = null;
      pendingTargetRef.current = null;
      if (dismissSessionTimerRef.current !== null) {
        window.clearTimeout(dismissSessionTimerRef.current);
        dismissSessionTimerRef.current = null;
      }
      shownDrawingIdRef.current = target.drawing.id;
      setHoverWithFade(target);
    };

    const commitTarget = (target: GuestBookDrawingHoverTarget) => {
      if (shownDrawingIdRef.current !== null) {
        if (target.drawing.id === shownDrawingIdRef.current) {
          showHover(target);
          return;
        }
        switchHover(target);
        return;
      }

      pendingTargetRef.current = target;

      if (
        hoverDelayTimerRef.current !== null &&
        pendingDrawingIdRef.current === target.drawing.id
      ) {
        return;
      }

      if (hoverDelayTimerRef.current !== null) {
        window.clearTimeout(hoverDelayTimerRef.current);
        hoverDelayTimerRef.current = null;
      }

      pendingDrawingIdRef.current = target.drawing.id;

      hoverDelayTimerRef.current = window.setTimeout(() => {
        hoverDelayTimerRef.current = null;
        if (pendingTargetRef.current) {
          showHover(pendingTargetRef.current, !spreadHoverRevealedRef.current);
        }
      }, GUEST_BOOK_HOVER_DELAY_MS);
    };

    const onFocusIn = (event: FocusEvent) => {
      const spread = spreadRef.current;
      if (!spread) return;

      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-guest-book-drawing]",
      );
      if (!el || !spread.contains(el)) return;

      if (leaveGraceTimerRef.current !== null) {
        window.clearTimeout(leaveGraceTimerRef.current);
        leaveGraceTimerRef.current = null;
      }
      if (hoverDelayTimerRef.current !== null) {
        window.clearTimeout(hoverDelayTimerRef.current);
        hoverDelayTimerRef.current = null;
      }
      pendingDrawingIdRef.current = null;
      pendingTargetRef.current = null;

      const target = buildTarget(el);
      if (!target) return;

      if (shownDrawingIdRef.current !== null) {
        if (target.drawing.id === shownDrawingIdRef.current) {
          showHover(target);
          return;
        }
        switchHover(target);
        return;
      }

      showHover(target, !spreadHoverRevealedRef.current);
    };

    const onFocusOut = (event: FocusEvent) => {
      const spread = spreadRef.current;
      if (!spread) return;

      const next = event.relatedTarget;
      if (
        next instanceof Element &&
        spread.contains(next) &&
        next.closest("[data-guest-book-drawing]")
      ) {
        return;
      }

      if (shownDrawingIdRef.current !== null) {
        scheduleClearHover();
        return;
      }
      clearHover();
    };

    const onDrawingMiss = () => {
      if (shownDrawingIdRef.current !== null) {
        scheduleClearHover();
        return;
      }
      clearHover();
    };

    const handlePointerAt = (clientX: number, clientY: number) => {
      const spread = spreadRef.current;
      if (!spread) return;

      const drawingEl = drawingElementUnderPoint(spread, clientX, clientY);
      if (!drawingEl) {
        onDrawingMiss();
        return;
      }

      if (leaveGraceTimerRef.current !== null) {
        window.clearTimeout(leaveGraceTimerRef.current);
        leaveGraceTimerRef.current = null;
      }

      const target = buildTarget(drawingEl);
      if (!target) {
        onDrawingMiss();
        return;
      }

      commitTarget(target);
    };

    probeHoverAtRef.current = handlePointerAt;

    const onMove = (event: MouseEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      const spread = spreadRef.current;
      if (!spread) return;

      const rect = measureSpread() ?? spread.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        onDrawingMiss();
        return;
      }

      handlePointerAt(clientX, clientY);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    const spread = spreadRef.current;
    if (spread) {
      spread.addEventListener("focusin", onFocusIn);
      spread.addEventListener("focusout", onFocusOut);
    }
    return () => {
      probeHoverAtRef.current = null;
      window.removeEventListener("mousemove", onMove);
      if (spread) {
        spread.removeEventListener("focusin", onFocusIn);
        spread.removeEventListener("focusout", onFocusOut);
      }
      if (hoverDelayTimerRef.current !== null) {
        window.clearTimeout(hoverDelayTimerRef.current);
      }
      if (dismissSessionTimerRef.current !== null) {
        window.clearTimeout(dismissSessionTimerRef.current);
      }
      if (leaveGraceTimerRef.current !== null) {
        window.clearTimeout(leaveGraceTimerRef.current);
      }
    };
  }, [
    spreadOpen,
    searchProfilePinned,
    animating,
    spreadRef,
    leftPageNum,
    rightPageNum,
    pages,
    measureSpread,
    setHoverWithFade,
  ]);

  const displayHover = searchProfilePinned ? searchProfileHover : mouseHover;
  const hoverCardsVisible = spreadOpen && !animating;

  useEffect(() => {
    const trackMouse =
      mouseHover !== null && !searchProfilePinned && hoverCardsVisible;
    const trackSearch = searchProfilePin !== null && spreadOpen;
    if (!trackMouse && !trackSearch) return;

    let frameId = 0;
    let lastMouseKey: string | null = null;
    let lastSearchKey: string | null = null;

    const tick = () => {
      const spread = spreadRef.current;
      if (!spread) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      if (trackMouse && mouseHoverRef.current) {
        const current = mouseHoverRef.current;
        const refreshed = refreshDrawingHoverTarget(
          spread,
          current.drawing,
          current.pageNumber,
          measureSpread,
          current.fadeIn,
        );
        if (refreshed) {
          const key = anchorPositionKey(refreshed.anchorRect, refreshed.spreadRect);
          if (key !== lastMouseKey) {
            lastMouseKey = key;
            commitMouseHover(refreshed);
          }
        }
      }

      if (trackSearch && searchProfilePin) {
        const drawing = guestBookDrawingById(pages, searchProfilePin.entryId);
        if (drawing) {
          const refreshed = refreshDrawingHoverTarget(
            spread,
            drawing,
            searchProfilePin.pageNumber,
            measureSpread,
            searchProfileCssFadeIn,
          );
          if (refreshed) {
            const key = anchorPositionKey(refreshed.anchorRect, refreshed.spreadRect);
            if (key !== lastSearchKey) {
              lastSearchKey = key;
              setSearchProfileHover(refreshed);
            }
          }
        }
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (trackSearch) setSearchProfileHover(null);
    };
  }, [
    mouseHover,
    mouseHover?.drawing.id,
    mouseHover?.pageNumber,
    searchProfilePin,
    searchProfileCssFadeIn,
    searchProfilePinned,
    hoverCardsVisible,
    spreadOpen,
    spreadRef,
    pages,
    measureSpread,
    commitMouseHover,
  ]);

  const profileCards =
    typeof document === "undefined" ? null : (
      <>
        {mouseHoverExit && hoverCardsVisible && !searchProfilePinned ? (
          <GuestBookDrawingProfileCard
            key={`exit-${mouseHoverExit.drawing.id}`}
            hover={mouseHoverExit}
            hoverFadingOut
            opacity={opacityFor(
              mouseHoverExit.drawing.id,
              mouseHoverExit.pageNumber,
            )}
          />
        ) : null}
        {displayHover && hoverCardsVisible ? (
          <GuestBookDrawingProfileCard
            key={displayHover.drawing.id}
            hover={displayHover}
            searchFadingOut={searchProfilePinned && searchProfileFadingOut}
            opacity={searchProfileCardOpacity(
              searchProfilePinned,
              searchProfileFadingOut,
              searchProfileFadeOpacity,
              displayHover,
              opacityFor(displayHover.drawing.id, displayHover.pageNumber),
            )}
          />
        ) : null}
      </>
    );

  return (
    <>
      {children}
      {profileCards ? createPortal(profileCards, document.body) : null}
    </>
  );
}

function GuestBookDrawingProfileCard({
  hover,
  opacity,
  searchFadingOut = false,
  hoverFadingOut = false,
}: {
  hover: GuestBookDrawingHoverTarget;
  opacity?: number;
  searchFadingOut?: boolean;
  hoverFadingOut?: boolean;
}) {
  const side = hover.pageNumber % 2 === 1 ? "left" : "right";
  const position = profilePosition(hover.anchorRect, hover.spreadRect, side);
  const showFadeIn = hover.fadeIn === true;
  const handleLabel = formatGuestBookHandleDisplay(
    hover.drawing.socialHandle,
    hover.drawing.socialType,
  );

  return (
    <div
      className={`guest-book-contributor guest-book-contributor--hover guest-book-contributor--${side}${
        showFadeIn ? " guest-book-contributor--fade-in" : ""
      }${searchFadingOut ? " guest-book-contributor--search-fade" : ""}${
        hoverFadingOut ? " guest-book-contributor--fade-out guest-book-contributor--hover-exit" : ""
      }`}
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
        opacity: searchFadingOut ? 0 : showFadeIn ? undefined : opacity,
      }}
      role="group"
      aria-label={`${hover.drawing.name}, ${handleLabel}`}
    >
      <span className="guest-book-contributor__avatar" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mementoAvatarUrl(hover.drawing.id)}
          alt=""
          decoding="async"
          draggable={false}
          onError={(event) => {
            const img = event.currentTarget;
            const fallback = `/api/memento/drawing/${hover.drawing.id}`;
            if (img.src !== fallback) img.src = fallback;
          }}
        />
      </span>
      <span className="guest-book-contributor__text">
        <span className="guest-book-contributor__name">{hover.drawing.name}</span>
        <span className="guest-book-contributor__handle">{handleLabel}</span>
      </span>
    </div>
  );
}
