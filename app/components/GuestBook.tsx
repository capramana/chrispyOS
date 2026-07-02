"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  guestBookPageCount,
  guestBookPageNumbersOnSpread,
  type GuestBookPageContent,
} from "@/lib/memento/guestBookPages";
import {
  GUEST_BOOK_BACK_CLOSED_STEP,
  GUEST_BOOK_CLICK_HINT_FADE_MS,
  GUEST_BOOK_FRONT_COVER_IDLE_HINT_MS,
  isGuestBookInteractiveTarget,
} from "@/lib/memento/guestBookConstants";
import { createBookLayout, getGuestBookRenderState, turnDurationMs } from "@/lib/memento/guestBookFlip";
import { guestBookDrawingSearchHighlightStyle } from "@/lib/memento/guestBookSearch";
import GuestBookSearch from "@/app/components/GuestBookSearch";
import { GuestBookHoverProvider } from "@/app/components/GuestBookDrawingHover";
import { LeatherMarginPageFace } from "@/app/components/GuestBookPage";
import { BackCoverFlipper, GuestBookSheet } from "@/app/components/GuestBookSheet";
import { useGuestBookNavigation } from "@/app/components/useGuestBookNavigation";
import "./GuestBook.css";

type GuestBookProps = {
  pages?: GuestBookPageContent[];
};

export default function GuestBook({ pages = [] }: GuestBookProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const searchOpenRef = useRef(false);

  const layout = useMemo(
    () => createBookLayout(guestBookPageCount(pages)),
    [pages],
  );

  const {
    step,
    prevStep,
    stepRef,
    prevStepRef,
    lockedRef,
    searchNavigatingRef,
    searchNavigating,
    searchFlip,
    searchRiffleMs,
    searchHighlight,
    searchProfilePin,
    searchProfileCssFadeIn,
    searchProfileFadingOut,
    searchProfilePinned,
    searchProfileFadeOpacity,
    navigateToEntry,
    openBook,
    openFromBack,
    turnForward,
    goForward,
    goBack,
    returnToFrontCover,
    closeBook,
    isBusy,
    settleStep,
  } = useGuestBookNavigation({ maxStep: layout.maxStep });

  const renderState = useMemo(
    () => getGuestBookRenderState(step, prevStep, layout, searchFlip, searchRiffleMs),
    [step, prevStep, layout, searchFlip, searchRiffleMs],
  );

  const {
    animating,
    searchRiffleStep,
    coverSpec,
    frontClosed,
    backClosed,
    interactStep,
    leftSheet,
    rightSheet,
    visibleSheets,
    flatRightPage,
    backCoverFlipActive,
    activeStageTransition,
  } = renderState;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest(".guest-book-search")) return;
      if (isBusy()) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goForward();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goForward, goBack, isBusy]);

  /** Safety net if animation timing drifts. */
  useEffect(() => {
    if (!lockedRef.current || step === prevStep) return;
    const durationMs = turnDurationMs(step, prevStep, layout.maxStep);
    const id = window.setTimeout(() => {
      if (lockedRef.current && stepRef.current !== prevStepRef.current) {
        settleStep();
      }
    }, durationMs + 100);
    return () => window.clearTimeout(id);
  }, [step, prevStep, layout.maxStep, settleStep]);

  const opacityFor = useCallback(
    (drawingId: string, pageNumber: number) =>
      guestBookDrawingSearchHighlightStyle(
        drawingId,
        pageNumber,
        searchHighlight,
        searchFlip,
        searchRiffleMs,
      ).opacity,
    [searchHighlight, searchFlip, searchRiffleMs],
  );

  const spreadOpen =
    interactStep >= 1 &&
    !(frontClosed && !animating) &&
    !(backClosed && !animating);
  const [leftPageNum, rightPageNum] = guestBookPageNumbersOnSpread(interactStep);

  const measureSpread = useCallback(() => {
    const stage = spreadRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (!spreadOpen) return rect;
    return new DOMRect(
      rect.left - rect.width,
      rect.top,
      rect.width * 2,
      rect.height,
    );
  }, [spreadOpen]);

  const dismissBackCover = useCallback(() => {
    if (isBusy()) return;
    if (stepRef.current === layout.maxStep) turnForward();
  }, [isBusy, layout.maxStep, turnForward, stepRef]);

  const onStationaryBackCoverPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const onStationaryBackCoverClick = useCallback(() => {
    dismissBackCover();
  }, [dismissBackCover]);

  const sheetProps = useMemo(
    () => ({
      step,
      prevStep,
      leftSheet,
      rightSheet,
      frontClosed,
      backClosed,
      animating,
      searchFlip,
      searchRiffleStep,
      searchRiffleMs,
      searchHighlight,
      layout,
      pageContents: pages,
      openBook,
      openFromBack,
      turnForward,
      goBack,
      dismissFrontCover: closeBook,
      dismissBackCover,
    }),
    [
      step,
      prevStep,
      leftSheet,
      rightSheet,
      frontClosed,
      backClosed,
      animating,
      searchFlip,
      searchRiffleStep,
      searchRiffleMs,
      searchHighlight,
      layout,
      pages,
      openBook,
      openFromBack,
      turnForward,
      goBack,
      closeBook,
      dismissBackCover,
    ],
  );

  const stationaryBackCoverInteractive =
    step === layout.maxStep && !animating && coverSpec.showStationaryBackCover;

  const frontCoverIdle =
    frontClosed && !animating && !searchNavigating && step === 0;
  const [showFrontCoverHint, setShowFrontCoverHint] = useState(false);
  const frontCoverIdleTimerRef = useRef<number | null>(null);

  const clearFrontCoverIdleTimer = useCallback(() => {
    if (frontCoverIdleTimerRef.current !== null) {
      window.clearTimeout(frontCoverIdleTimerRef.current);
      frontCoverIdleTimerRef.current = null;
    }
  }, []);

  const showFrontCoverHintOnPage =
    frontCoverIdle && showFrontCoverHint;

  const armFrontCoverIdleHint = useCallback(() => {
    clearFrontCoverIdleTimer();
    if (!frontCoverIdle) return;

    frontCoverIdleTimerRef.current = window.setTimeout(() => {
      frontCoverIdleTimerRef.current = null;
      setShowFrontCoverHint(true);
    }, GUEST_BOOK_FRONT_COVER_IDLE_HINT_MS);
  }, [clearFrontCoverIdleTimer, frontCoverIdle]);

  const resetFrontCoverIdleHint = useCallback(() => {
    clearFrontCoverIdleTimer();
    setShowFrontCoverHint(false);
    armFrontCoverIdleHint();
  }, [armFrontCoverIdleHint, clearFrontCoverIdleTimer]);

  useEffect(() => {
    armFrontCoverIdleHint();
    return clearFrontCoverIdleTimer;
  }, [armFrontCoverIdleHint, clearFrontCoverIdleTimer]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (event: PointerEvent) => {
      resetFrontCoverIdleHint();

      if (searchNavigatingRef.current) return;
      if (searchOpenRef.current) return;

      const backCoverShut =
        stepRef.current === GUEST_BOOK_BACK_CLOSED_STEP;

      if (!backCoverShut) {
        if (lockedRef.current) return;

        const spreadRect = measureSpread();
        if (spreadRect) {
          const { clientX, clientY } = event;
          if (
            clientX >= spreadRect.left &&
            clientX <= spreadRect.right &&
            clientY >= spreadRect.top &&
            clientY <= spreadRect.bottom
          ) {
            return;
          }
        }
      }

      if (isGuestBookInteractiveTarget(event.target)) return;
      if (stepRef.current === 0) return;

      void returnToFrontCover();
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("keydown", resetFrontCoverIdleHint);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("keydown", resetFrontCoverIdleHint);
    };
  }, [
    returnToFrontCover,
    resetFrontCoverIdleHint,
    measureSpread,
    lockedRef,
    searchNavigatingRef,
    stepRef,
  ]);

  return (
    <GuestBookHoverProvider
      spreadRef={spreadRef}
      measureSpread={measureSpread}
      spreadOpen={spreadOpen}
      animating={animating}
      step={step}
      leftPageNum={leftPageNum}
      rightPageNum={rightPageNum}
      searchProfilePin={searchProfilePin}
      searchProfileFadingOut={searchProfileFadingOut}
      searchProfileCssFadeIn={searchProfileCssFadeIn}
      searchProfileFadeOpacity={searchProfileFadeOpacity}
      pages={pages}
      opacityFor={opacityFor}
    >
      <div ref={rootRef} className="guest-book-root">
        <GuestBookSearch
          pages={pages}
          onSelect={navigateToEntry}
          navigating={searchNavigating}
          spreadStep={spreadOpen && interactStep >= 1 ? interactStep : null}
          onOpenChange={(open) => {
            searchOpenRef.current = open;
          }}
        />

        <motion.div
          className="guest-book-center-cluster"
          initial={false}
          animate={{
            x: `${coverSpec.stagePct}%`,
            y: "-50%",
          }}
          transition={activeStageTransition}
        >
          <div className="guest-book-center-stack">
            <div ref={spreadRef} className="guest-book-stage-wrap">
              <div className="guest-book-stage">
                <div className="guest-book">
                <div
                  className={`guest-book-spine${
                    coverSpec.showSpine ? "" : " guest-book-spine--hidden"
                  }`}
                  aria-hidden
                />

                <div
                  className={[
                    "guest-book-board",
                    coverSpec.showBoard ? "" : "guest-book-board--hidden",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                />

                {stationaryBackCoverInteractive ? (
                  <button
                    type="button"
                    className="guest-book-back-cover guest-book-back-cover--interactive"
                    aria-label="Close guestbook"
                    onPointerDown={onStationaryBackCoverPointerDown}
                    onClick={onStationaryBackCoverClick}
                  />
                ) : (
                  <div
                    className={`guest-book-back-cover${
                      coverSpec.showStationaryBackCover
                        ? ""
                        : " guest-book-back-cover--hidden"
                    }`}
                    aria-hidden
                  />
                )}

                {flatRightPage !== null ? (
                  <div className="guest-book-flat-right" aria-hidden>
                    <div className="guest-book-half guest-book-half--front guest-book-half--cover">
                      <LeatherMarginPageFace
                        pageNumber={flatRightPage}
                        pageContents={pages}
                        searchHighlight={searchHighlight}
                        searchFlip={searchFlip}
                        searchRiffleMs={searchRiffleMs}
                      />
                    </div>
                  </div>
                ) : null}

                {Array.from({ length: layout.sheetCount }, (_, sheetIndex) => (
                  <GuestBookSheet
                    key={sheetIndex}
                    sheetIndex={sheetIndex}
                    visible={visibleSheets.has(sheetIndex)}
                    {...sheetProps}
                  />
                ))}

                <BackCoverFlipper
                  step={step}
                  prevStep={prevStep}
                  layout={layout}
                  active={backCoverFlipActive}
                  pageContents={pages}
                  searchFlip={searchFlip}
                  searchRiffleStep={searchRiffleStep}
                  searchRiffleMs={searchRiffleMs}
                  searchHighlight={searchHighlight}
                  dismissFrontCover={closeBook}
                  dismissBackCover={dismissBackCover}
                  animating={animating}
                />
                </div>
              </div>
            </div>
            {frontCoverIdle ? (
              <p
                className={`guest-book-click-hint${
                  showFrontCoverHintOnPage ? " guest-book-click-hint--visible" : ""
                }`}
                style={{
                  transition: `opacity ${GUEST_BOOK_CLICK_HINT_FADE_MS}ms ease`,
                }}
                aria-hidden
              >
                Click to open
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </GuestBookHoverProvider>
  );
}
