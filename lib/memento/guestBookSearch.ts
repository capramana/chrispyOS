import {
  guestBookIsPageOnSpread,
  guestBookStepForPageNumber,
  type GuestBookSearchEntry,
} from "@/lib/memento/guestBookPages";

export const GUEST_BOOK_HOVER_DELAY_MS = 500;
export const GUEST_BOOK_HOVER_FADE_IN_MS = 200;
export const GUEST_BOOK_HOVER_FADE_OUT_MS = 200;

/** Matches `.guest-book-page__scatter-item` opacity / filter transition. */
export const GUEST_BOOK_HIGHLIGHT_FADE_MS = 500;

const SEARCH_HIGHLIGHT_DIM = 0.25;
const SEARCH_HIGHLIGHT_BLUR_PX = 2;

export type GuestBookSearchFlip = {
  fromStep: number;
  toStep: number;
  flipMs: number;
  staggerMs: number;
};

export type GuestBookSearchHighlight = {
  entryId: string;
  spreadStep: number;
};

export type GuestBookSearchProfilePin = {
  entryId: string;
  pageNumber: number;
};

export type GuestBookPageSearchProps = {
  searchHighlight: GuestBookSearchHighlight | null;
  searchFlip: GuestBookSearchFlip | null;
  searchRiffleMs: number;
};

export function guestBookSearchFlipTotalMs(flip: GuestBookSearchFlip): number {
  const flipCount = Math.abs(flip.toStep - flip.fromStep);
  if (flipCount <= 1) return flip.flipMs;
  return (flipCount - 1) * flip.staggerMs + flip.flipMs;
}

/** 0 at flip start → 1 at flip end. */
export function guestBookSearchFlipProgress(
  flip: GuestBookSearchFlip,
  elapsedMs: number,
): number {
  const totalMs = guestBookSearchFlipTotalMs(flip);
  if (totalMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

/** 0 until the last `windowMs` of the flip, then 0 → 1 across that window. */
export function guestBookSearchFlipWindowProgress(
  flip: GuestBookSearchFlip,
  elapsedMs: number,
  windowMs: number,
): number {
  const totalMs = guestBookSearchFlipTotalMs(flip);
  const startMs = totalMs - windowMs;
  if (elapsedMs <= startMs) return 0;
  if (elapsedMs >= totalMs) return 1;
  return (elapsedMs - startMs) / windowMs;
}

export function guestBookSearchFlipStaggerMs(
  flipMs: number,
  ratio = 0.15,
): number {
  return Math.round(flipMs * ratio);
}

export function clearGuestBookTimeoutRef(ref: { current: number | null }): void {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export function guestBookSearchHighlightForEntry(
  entry: GuestBookSearchEntry,
): GuestBookSearchHighlight {
  return {
    entryId: entry.id,
    spreadStep: guestBookStepForPageNumber(entry.pageNumber),
  };
}

/** Ms until dim/blur dismiss — ramp (CSS or flip scrub) then hold at full strength. */
export function guestBookSearchHighlightDismissDelay(flipTotalMs: number): number {
  const rampMs = flipTotalMs > 0 ? flipTotalMs : GUEST_BOOK_HIGHLIGHT_FADE_MS;
  return rampMs + GUEST_BOOK_HIGHLIGHT_FADE_MS;
}

export function guestBookDrawingSearchHighlightStyle(
  drawingId: string,
  pageNumber: number,
  highlight: GuestBookSearchHighlight | null,
  searchFlip: GuestBookSearchFlip | null = null,
  searchRiffleMs = 0,
): { opacity: number; filter: string } {
  if (!highlight || !guestBookIsPageOnSpread(pageNumber, highlight.spreadStep)) {
    return { opacity: 1, filter: "blur(0px)" };
  }
  if (drawingId === highlight.entryId) {
    return { opacity: 1, filter: "blur(0px)" };
  }

  const amount = searchFlip
    ? guestBookSearchFlipProgress(searchFlip, searchRiffleMs)
    : 1;
  return {
    opacity: 1 - amount * (1 - SEARCH_HIGHLIGHT_DIM),
    filter: `blur(${amount * SEARCH_HIGHLIGHT_BLUR_PX}px)`,
  };
}
