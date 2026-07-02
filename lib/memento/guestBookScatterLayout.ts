import {
  guestBookDrawingLayoutScale,
  type GuestBookDrawing,
} from "@/lib/memento/guestBookPages";

/**
 * Scatter layout spacing (all in CSS px on the guest-book page face).
 *
 * - EDGE: every drawing’s bounding box stays at least this far from the page
 *   sides and top. The bottom also respects EDGE plus DATE_RESERVE.
 * - GAP: minimum clear space between any two drawing bounding boxes.
 */
export const GUEST_BOOK_PAGE_EDGE_MARGIN_PX = 20;
export const GUEST_BOOK_DRAWING_GAP_PX = 20;
/** Bottom band reserved for the printed date label. */
export const GUEST_BOOK_PAGE_NUMBER_RESERVE_PX = 20;

/** @deprecated Use GUEST_BOOK_PAGE_EDGE_MARGIN_PX */
export const GUEST_BOOK_PAGE_INSET_PX = GUEST_BOOK_PAGE_EDGE_MARGIN_PX;

const MAX_RANDOM_ATTEMPTS = 200;
const GRID_SCAN_STEP_PX = 4;
const MIN_LAYOUT_SCALE = 0.35;
export const GUEST_BOOK_SCATTER_ALGO_VERSION = "random-v2";

export type DrawingNaturalSize = {
  width: number;
  height: number;
};

export type PlacedGuestBookDrawing = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scaledDrawingSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  scale = 1,
): Size {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    const fallback = maxWidth * scale;
    return { width: fallback, height: fallback * 0.75 };
  }

  const targetMaxWidth = maxWidth * scale;
  const fitScale = Math.min(1, targetMaxWidth / naturalWidth);
  return {
    width: naturalWidth * fitScale,
    height: naturalHeight * fitScale,
  };
}

/** Max width so multiple drawings can share a page without crowding. */
export function maxDrawingWidthForPage(
  pageWidth: number,
  pageHeight: number,
  count: number,
  edgeMargin = GUEST_BOOK_PAGE_EDGE_MARGIN_PX,
  bottomReserve = GUEST_BOOK_PAGE_NUMBER_RESERVE_PX,
): number {
  const usableWidth = pageWidth - edgeMargin * 2;
  const usableHeight = pageHeight - edgeMargin * 2 - bottomReserve;
  if (usableWidth <= 0 || usableHeight <= 0 || count <= 0) return usableWidth;

  const widthCapByCount: Record<number, number> = {
    1: 0.72,
    2: 0.5,
    3: 0.4,
    4: 0.36,
    5: 0.32,
  };
  const widthFraction = widthCapByCount[count] ?? 0.3;

  const areaShare = (usableWidth * usableHeight) / count;
  const maxFromArea = Math.sqrt(areaShare * 0.72);

  return Math.min(usableWidth * widthFraction, maxFromArea, usableWidth * 0.75);
}

function fitsInBounds(
  rect: Rect,
  pageWidth: number,
  pageHeight: number,
  edgeMargin: number,
  bottomReserve: number,
): boolean {
  return (
    rect.x >= edgeMargin &&
    rect.y >= edgeMargin &&
    rect.x + rect.width <= pageWidth - edgeMargin &&
    rect.y + rect.height <= pageHeight - edgeMargin - bottomReserve
  );
}

function expandedRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function hasCollision(candidate: Rect, placed: Rect[], gap: number): boolean {
  const halfGap = gap / 2;
  const paddedCandidate = expandedRect(candidate, halfGap);
  return placed.some((rect) =>
    rectsOverlap(paddedCandidate, expandedRect(rect, halfGap)),
  );
}

function isValidPlacement(
  rect: Rect,
  placed: Rect[],
  pageWidth: number,
  pageHeight: number,
  edgeMargin: number,
  gap: number,
  bottomReserve: number,
): boolean {
  return (
    fitsInBounds(rect, pageWidth, pageHeight, edgeMargin, bottomReserve) &&
    !hasCollision(rect, placed, gap)
  );
}

/** Uniform random position; first valid candidate wins. */
function findRandomPlacement(input: {
  size: Size;
  placed: Rect[];
  pageWidth: number;
  pageHeight: number;
  edgeMargin: number;
  gap: number;
  bottomReserve: number;
  rng: () => number;
}): Rect | null {
  const {
    size,
    placed,
    pageWidth,
    pageHeight,
    edgeMargin,
    gap,
    bottomReserve,
    rng,
  } = input;

  const maxX = pageWidth - edgeMargin - size.width;
  const maxY = pageHeight - edgeMargin - bottomReserve - size.height;
  if (maxX < edgeMargin || maxY < edgeMargin) return null;

  const tryAt = (x: number, y: number): Rect | null => {
    const rect = { x, y, width: size.width, height: size.height };
    return isValidPlacement(
      rect,
      placed,
      pageWidth,
      pageHeight,
      edgeMargin,
      gap,
      bottomReserve,
    )
      ? rect
      : null;
  };

  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
    const placedRect = tryAt(
      edgeMargin + rng() * (maxX - edgeMargin),
      edgeMargin + rng() * (maxY - edgeMargin),
    );
    if (placedRect) return placedRect;
  }

  for (let y = edgeMargin; y <= maxY; y += GRID_SCAN_STEP_PX) {
    for (let x = edgeMargin; x <= maxX; x += GRID_SCAN_STEP_PX) {
      const placedRect = tryAt(x, y);
      if (placedRect) return placedRect;
    }
  }

  return null;
}

export function scatterGuestBookDrawings(input: {
  pageNumber: number;
  drawings: GuestBookDrawing[];
  sizes: DrawingNaturalSize[];
  pageWidth: number;
  pageHeight: number;
  edgeMargin?: number;
  gap?: number;
  bottomReserve?: number;
}): PlacedGuestBookDrawing[] {
  const {
    pageNumber,
    drawings,
    sizes,
    pageWidth,
    pageHeight,
    edgeMargin = GUEST_BOOK_PAGE_EDGE_MARGIN_PX,
    gap = GUEST_BOOK_DRAWING_GAP_PX,
    bottomReserve = GUEST_BOOK_PAGE_NUMBER_RESERVE_PX,
  } = input;

  if (pageWidth <= 0 || pageHeight <= 0 || drawings.length === 0) {
    return [];
  }

  const maxWidth = maxDrawingWidthForPage(
    pageWidth,
    pageHeight,
    drawings.length,
    edgeMargin,
    bottomReserve,
  );
  const seed = hashString(
    `${GUEST_BOOK_SCATTER_ALGO_VERSION}:${pageNumber}:${drawings.map((drawing) => drawing.id).join("|")}`,
  );
  const rng = createRng(seed);

  const order = seededShuffle(
    drawings.map((drawing, index) => ({ drawing, index })),
    rng,
  );

  const placedRects: Rect[] = [];
  const placements: PlacedGuestBookDrawing[] = [];

  for (const { drawing, index } of order) {
    const natural = sizes[index] ?? { width: maxWidth, height: maxWidth * 0.75 };
    let scale = guestBookDrawingLayoutScale(drawing.id);
    let placed: Rect | null = null;

    while (!placed && scale >= MIN_LAYOUT_SCALE) {
      const size = scaledDrawingSize(
        natural.width,
        natural.height,
        maxWidth,
        scale,
      );

      placed = findRandomPlacement({
        size,
        placed: placedRects,
        pageWidth,
        pageHeight,
        edgeMargin,
        gap,
        bottomReserve,
        rng,
      });

      if (!placed) {
        scale *= 0.88;
      }
    }

    if (!placed) continue;

    placedRects.push(placed);
    placements.push({
      id: drawing.id,
      name: drawing.name,
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
    });
  }

  return placements;
}
