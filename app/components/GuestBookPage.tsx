"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatGuestBookPageDate,
  guestBookIsPageOnSpread,
  isGuestBookFullPageDrawing,
  type GuestBookPageContent,
} from "@/lib/memento/guestBookPages";
import { loadDrawingNaturalSize } from "@/lib/memento/loadDrawingNaturalSize";
import {
  GUEST_BOOK_SCATTER_ALGO_VERSION,
  scatterGuestBookDrawings,
  type PlacedGuestBookDrawing,
} from "@/lib/memento/guestBookScatterLayout";
import {
  guestBookDrawingSearchHighlightStyle,
  type GuestBookPageSearchProps,
} from "@/lib/memento/guestBookSearch";

export function GuestBookPage({
  number,
  content,
  searchHighlight,
  searchFlip,
  searchRiffleMs,
  onPageDismiss,
}: {
  number: number;
  content: GuestBookPageContent | null;
  onPageDismiss?: () => void;
} & GuestBookPageSearchProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const layoutRunIdRef = useRef(0);
  const drawingSizeCacheRef = useRef(
    new Map<string, { width: number; height: number }>(),
  );
  const [placements, setPlacements] = useState<PlacedGuestBookDrawing[] | null>(
    null,
  );
  const drawings = useMemo(
    () => content?.drawings ?? [],
    [content?.drawings],
  );
  const hasDrawings = drawings.length > 0;
  const fullPageDrawing =
    drawings.length === 1 && isGuestBookFullPageDrawing(drawings[0].id)
      ? drawings[0]
      : null;
  const pageLabel = content?.date ? formatGuestBookPageDate(content.date) : null;
  const layoutKey = `${GUEST_BOOK_SCATTER_ALGO_VERSION}:${number}:${drawings.map((drawing) => drawing.id).join(",")}`;
  const highlightStyleFor = (drawingId: string) =>
    guestBookDrawingSearchHighlightStyle(
      drawingId,
      number,
      searchHighlight,
      searchFlip,
      searchRiffleMs,
    );
  const onHighlightSpread =
    searchHighlight !== null &&
    guestBookIsPageOnSpread(number, searchHighlight.spreadStep);
  const highlightScrubbing = onHighlightSpread && searchFlip !== null;

  const handleDismissPointerDown = (event: React.PointerEvent) => {
    if (!onPageDismiss) return;
    event.stopPropagation();
  };

  const handleDismissClick = (event: React.MouseEvent) => {
    if (!onPageDismiss) return;
    event.stopPropagation();
    onPageDismiss();
  };

  useLayoutEffect(() => {
    if (!hasDrawings || fullPageDrawing) return;

    const page = pageRef.current;
    if (!page) return;

    let cancelled = false;
    const sizeCache = drawingSizeCacheRef.current;

    const runLayout = async () => {
      const runId = ++layoutRunIdRef.current;
      const pageWidth = page.clientWidth;
      const pageHeight = page.clientHeight;
      if (pageWidth <= 0 || pageHeight <= 0) return;

      const sizes = await Promise.all(
        drawings.map(async (drawing) => {
          const cached = sizeCache.get(drawing.id);
          if (cached) return cached;

          const size = await loadDrawingNaturalSize(
            `/api/memento/drawing/${drawing.id}`,
          ).catch(() => ({
            width: pageWidth * 0.5,
            height: pageWidth * 0.38,
          }));
          sizeCache.set(drawing.id, size);
          return size;
        }),
      );

      if (cancelled || runId !== layoutRunIdRef.current) return;

      setPlacements(
        scatterGuestBookDrawings({
          pageNumber: number,
          drawings,
          sizes,
          pageWidth,
          pageHeight,
        }),
      );
    };

    void runLayout();

    const observer = new ResizeObserver(() => {
      void runLayout();
    });
    observer.observe(page);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [drawings, fullPageDrawing, hasDrawings, layoutKey, number]);

  return (
    <div
      ref={pageRef}
      className={`guest-book-page${hasDrawings ? " guest-book-page--filled" : ""}${
        fullPageDrawing ? " guest-book-page--full-bleed" : ""
      }${number % 2 === 1 ? " guest-book-page--outer-left" : " guest-book-page--outer-right"}${
        onHighlightSpread ? " guest-book-page--highlight-active" : ""
      }${highlightScrubbing ? " guest-book-page--highlight-scrub" : ""}${
        onPageDismiss ? " guest-book-page--dismiss" : ""
      }`}
      data-page-number={number}
      onPointerDown={handleDismissPointerDown}
      onClick={handleDismissClick}
    >
      <span className="guest-book-page__gutter-line" aria-hidden />
      {fullPageDrawing ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="guest-book-page__full-bleed"
            src={`/api/memento/drawing/${fullPageDrawing.id}`}
            alt={fullPageDrawing.name}
            data-guest-book-drawing={fullPageDrawing.id}
            tabIndex={0}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={highlightStyleFor(fullPageDrawing.id)}
          />
        </>
      ) : null}
      {hasDrawings && !fullPageDrawing && placements ? (
        <div className="guest-book-page__scatter">
          {placements.map((placement) => {
            const drawing = drawings.find((item) => item.id === placement.id);
            if (!drawing) return null;

            return (
              <div
                key={placement.id}
                className="guest-book-page__scatter-item"
                data-guest-book-drawing={placement.id}
                tabIndex={0}
                aria-label={drawing.name}
                style={{
                  left: `${placement.x}px`,
                  top: `${placement.y}px`,
                  width: `${placement.width}px`,
                  height: `${placement.height}px`,
                  ...highlightStyleFor(placement.id),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/memento/drawing/${placement.id}`}
                  alt={placement.name}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
      ) : null}
      {pageLabel ? (
        <span className="guest-book-page__date">{pageLabel}</span>
      ) : null}
    </div>
  );
}

export function guestBookPageContentForNumber(
  pageContents: GuestBookPageContent[],
  pageNumber: number,
): GuestBookPageContent | null {
  return pageContents[pageNumber - 1] ?? null;
}

/** Right-side page inset on full-bleed leather (last page, flipper, front-close flat layer). */
export function LeatherMarginPageFace({
  pageNumber,
  pageContents,
  searchHighlight,
  searchFlip,
  searchRiffleMs,
  onPageDismiss,
}: {
  pageNumber: number;
  pageContents: GuestBookPageContent[];
  onPageDismiss?: () => void;
} & GuestBookPageSearchProps) {
  return (
    <>
      <div className="guest-book-leather-panel" aria-hidden />
      <div
        className={`guest-book-slot guest-book-half--page ${pageOuterClass(pageNumber)}`}
      >
        <GuestBookPage
          number={pageNumber}
          content={guestBookPageContentForNumber(pageContents, pageNumber)}
          searchHighlight={searchHighlight}
          searchFlip={searchFlip}
          searchRiffleMs={searchRiffleMs}
          onPageDismiss={onPageDismiss}
        />
      </div>
    </>
  );
}

function pageOuterClass(pageNumber: number) {
  return pageNumber % 2 === 1
    ? "guest-book-half--page-outer-left"
    : "guest-book-half--page-outer-right";
}
