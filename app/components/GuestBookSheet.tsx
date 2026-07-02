"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GuestBookPageContent } from "@/lib/memento/guestBookPages";
import type { GuestBookPageSearchProps } from "@/lib/memento/guestBookSearch";
import {
  frontPageNumber,
  backPageNumber,
  pageOuterClass,
  resolveSheetMotion,
  type BookLayout,
} from "@/lib/memento/guestBookFlip";
import {
  guestBookPageInteraction,
  resolveGuestBookForwardTurn,
  resolveGuestBookPageDismiss,
} from "@/lib/memento/guestBookInteraction";
import { GuestBookSheetPageFace } from "@/app/components/GuestBookPage";

type GuestBookSheetProps = {
  sheetIndex: number;
  step: number;
  prevStep: number;
  visible: boolean;
  leftSheet: number;
  rightSheet: number;
  frontClosed: boolean;
  backClosed: boolean;
  animating: boolean;
  searchRiffleStep: number | null;
  layout: BookLayout;
  pageContents: GuestBookPageContent[];
  openBook: () => void;
  openFromBack: () => void;
  turnForward: () => void;
  goForward: () => void;
  goBack: () => void;
  closeBook: () => void;
  dismissBackCover: () => void;
} & GuestBookPageSearchProps;

function GuestBookTurnMargins({
  active,
  onTurn,
  label,
}: {
  active: boolean;
  onTurn: () => void;
  label: string;
}) {
  if (!active) return null;

  return (
    <div className="guest-book-turn-margins">
      {(["top", "right", "bottom", "left"] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          className={`guest-book-turn-margin guest-book-turn-margin--${edge}`}
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation();
            onTurn();
          }}
        />
      ))}
    </div>
  );
}

function GuestBookTurnSurface({
  onTurn,
  label,
}: {
  onTurn: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="guest-book-turn-surface"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onTurn();
      }}
    />
  );
}

function GuestBookInteractiveLeatherPanel({
  active,
  onTurn,
  label,
  className,
}: {
  active: boolean;
  onTurn: () => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`guest-book-leather-panel${className ? ` ${className}` : ""}${
        active ? " guest-book-leather-panel--interactive" : ""
      }`}
      role={active ? "button" : undefined}
      tabIndex={active ? 0 : undefined}
      aria-label={active ? label : undefined}
      onPointerDown={
        active
          ? (event) => {
              event.stopPropagation();
            }
          : undefined
      }
      onClick={
        active
          ? (event) => {
              event.stopPropagation();
              onTurn();
            }
          : undefined
      }
      onKeyDown={
        active
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTurn();
              }
            }
          : undefined
      }
    />
  );
}

export function GuestBookSheet({
  sheetIndex,
  step,
  prevStep,
  visible,
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
  pageContents,
  openBook,
  openFromBack,
  turnForward,
  goForward,
  goBack,
  closeBook,
  dismissBackCover,
}: GuestBookSheetProps) {
  const { sheetCount } = layout;
  const lastSheet = sheetCount - 1;
  const frontPage = frontPageNumber(sheetIndex, layout);
  const backPage = backPageNumber(sheetIndex, layout);
  const searchProps = { searchHighlight, searchFlip, searchRiffleMs };
  const interactionCtx = useMemo(
    () => ({
      step,
      animating,
      frontClosed,
      backClosed,
      layout,
      goBack,
      goForward,
      closeBook,
      dismissBackCover,
    }),
    [
      step,
      animating,
      frontClosed,
      backClosed,
      layout,
      goBack,
      goForward,
      closeBook,
      dismissBackCover,
    ],
  );
  const pageFace = (pageNumber: number, leatherMargin = false) => (
    <GuestBookSheetPageFace
      pageNumber={pageNumber}
      pageContents={pageContents}
      leatherMargin={leatherMargin}
      bookStep={step}
      {...searchProps}
      {...guestBookPageInteraction(pageNumber, interactionCtx)}
    />
  );
  const isLeftTarget = sheetIndex === leftSheet;
  const isRightTarget = sheetIndex === rightSheet;
  const isBackCoverTarget =
    backClosed && sheetIndex === lastSheet && !animating;
  const isLastSheet = sheetIndex === lastSheet;
  const isLastPageFront = isLastSheet && frontPage !== null;
  const frontHalfIsCover = sheetIndex === 0;
  const { rotateY, translateZ, transition: sheetTransition } = resolveSheetMotion(
    sheetIndex,
    step,
    prevStep,
    layout,
    searchFlip,
    searchRiffleStep,
    searchRiffleMs,
  );
  const frontTurnActive =
    (isRightTarget || isBackCoverTarget) && !animating && !frontClosed;
  const backTurnActive = (isLeftTarget || isBackCoverTarget) && !animating;
  const turnForwardAction = resolveGuestBookForwardTurn(
    isBackCoverTarget,
    frontClosed,
    openFromBack,
    openBook,
    turnForward,
  );
  const turnBackAction = isBackCoverTarget ? openFromBack : goBack;

  return (
    <motion.div
      className={`guest-book-sheet${
        sheetIndex === 0 && frontClosed ? " guest-book-sheet--closed" : ""
      }${
        isLastSheet && backClosed ? " guest-book-sheet--back-closed" : ""
      }`}
      initial={false}
      animate={{
        rotateY,
        z: translateZ,
      }}
      transition={sheetTransition}
      style={{
        visibility: visible ? "visible" : "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        className={`guest-book-half guest-book-half--front${
          frontHalfIsCover || isLastPageFront
            ? " guest-book-half--cover"
            : " guest-book-slot"
        }${isRightTarget ? " guest-book-half--turn" : ""}${
          !isLastPageFront && frontPage !== null ? " guest-book-half--page" : ""
        }${
          !isLastPageFront && frontPage !== null
            ? ` ${pageOuterClass(frontPage)}`
            : ""
        }${isBackCoverTarget ? " guest-book-half--turn" : ""}`}
      >
        <GuestBookTurnMargins
          active={(isRightTarget || isBackCoverTarget) && !animating}
          label="Turn page forward"
          onTurn={turnForwardAction}
        />
        {sheetIndex === 0 ? (
          <GuestBookInteractiveLeatherPanel
            active={isRightTarget && !animating && frontClosed}
            onTurn={openBook}
            label="Open guestbook"
            className="guest-book-leather-panel--front"
          />
        ) : isLastPageFront && frontPage !== null ? (
          <>
            {frontTurnActive ? (
              <GuestBookTurnSurface
                label="Turn page forward"
                onTurn={turnForward}
              />
            ) : null}
            {pageFace(frontPage, true)}
          </>
        ) : frontPage !== null ? (
          <>
            {frontTurnActive ? (
              <GuestBookTurnSurface
                label="Turn page forward"
                onTurn={turnForwardAction}
              />
            ) : null}
            {pageFace(frontPage)}
          </>
        ) : null}
      </div>

      <div
        className={`guest-book-half guest-book-half--back${
          sheetIndex === 0 ? " guest-book-half--cover-backing" : ""
        }${
          sheetIndex === lastSheet ? " guest-book-half--cover" : ""
        }${sheetIndex !== 0 && sheetIndex !== lastSheet ? " guest-book-slot" : ""}${
          isLeftTarget ? " guest-book-half--turn" : ""
        }${backPage !== null && sheetIndex !== 0 ? " guest-book-half--page" : ""}${
          backPage !== null && sheetIndex !== 0
            ? ` ${pageOuterClass(backPage)}`
            : ""
        }${isBackCoverTarget ? " guest-book-half--turn" : ""}`}
      >
        <GuestBookTurnMargins
          active={(isLeftTarget || isBackCoverTarget) && !animating}
          label="Turn page back"
          onTurn={turnBackAction}
        />
        {sheetIndex === 0 && backPage !== null ? (
          <div
            className={`guest-book-slot guest-book-slot--left-page guest-book-half--page ${pageOuterClass(backPage)}`}
          >
            {backTurnActive ? (
              <GuestBookTurnSurface
                label="Turn page back"
                onTurn={turnBackAction}
              />
            ) : null}
            {pageFace(backPage)}
          </div>
        ) : sheetIndex === lastSheet ? (
          <GuestBookInteractiveLeatherPanel
            active={isBackCoverTarget}
            className="guest-book-leather-panel--back"
            onTurn={openFromBack}
            label="Open guestbook from back cover"
          />
        ) : backPage !== null ? (
          <>
            {backTurnActive ? (
              <GuestBookTurnSurface
                label="Turn page back"
                onTurn={turnBackAction}
              />
            ) : null}
            {pageFace(backPage)}
          </>
        ) : null}
      </div>
    </motion.div>
  );
}

/** Page endpaper + cover; always mounted — visibility only (never conditional mount). */
export function BackCoverFlipper({
  step,
  prevStep,
  layout,
  active,
  pageContents,
  searchFlip,
  searchRiffleStep,
  searchRiffleMs,
  searchHighlight,
  closeBook,
  dismissBackCover,
  animating,
}: {
  step: number;
  prevStep: number;
  layout: BookLayout;
  active: boolean;
  pageContents: GuestBookPageContent[];
  searchRiffleStep: number | null;
  closeBook: () => void;
  dismissBackCover: () => void;
  animating: boolean;
} & GuestBookPageSearchProps) {
  const lastSheet = layout.sheetCount - 1;
  const lastPage = frontPageNumber(lastSheet, layout);
  const lastPageDismiss =
    lastPage !== null
      ? resolveGuestBookPageDismiss(
          lastPage,
          step,
          animating,
          layout,
          closeBook,
          dismissBackCover,
        )
      : undefined;
  const { rotateY, translateZ, transition: sheetTransition } = resolveSheetMotion(
    lastSheet,
    step,
    prevStep,
    layout,
    searchFlip,
    searchRiffleStep,
    searchRiffleMs,
  );

  return (
    <motion.div
      className="guest-book-sheet guest-book-back-cover-flipper"
      initial={false}
      animate={{
        rotateY,
        z: translateZ,
      }}
      transition={sheetTransition}
      style={{
        visibility: active ? "visible" : "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <div className="guest-book-half guest-book-half--front guest-book-half--cover">
        {lastPage !== null ? (
          <GuestBookSheetPageFace
            pageNumber={lastPage}
            pageContents={pageContents}
            leatherMargin
            bookStep={step}
            searchHighlight={searchHighlight}
            searchFlip={searchFlip}
            searchRiffleMs={searchRiffleMs}
            onPageDismiss={lastPageDismiss}
          />
        ) : null}
      </div>
      <div className="guest-book-half guest-book-half--back guest-book-half--cover">
        <div className="guest-book-leather-panel guest-book-leather-panel--back" />
      </div>
    </motion.div>
  );
}
