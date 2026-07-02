import {
  guestBookDrawingById,
  type GuestBookDrawing,
  type GuestBookPageContent,
} from "@/lib/memento/guestBookPages";

export type GuestBookDrawingHoverTarget = {
  drawing: GuestBookDrawing;
  pageNumber: number;
  anchorRect: DOMRect;
  spreadRect: DOMRect | null;
  fadeIn?: boolean;
};

export function drawingAnchorRect(el: HTMLElement): DOMRect | null {
  const host = el.closest<HTMLElement>("[data-guest-book-drawing]") ?? el;
  const target = host.matches("img")
    ? host
    : (host.querySelector("img") ?? host);
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

export function isVisibleSheetElement(el: Element): boolean {
  const sheet = el.closest(".guest-book-sheet");
  if (!(sheet instanceof HTMLElement)) return false;
  return getComputedStyle(sheet).visibility !== "hidden";
}

export function drawingElementUnderPoint(
  spread: HTMLElement,
  x: number,
  y: number,
): HTMLElement | null {
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof Element) || !spread.contains(node)) continue;

    const drawingEl = (
      node.matches("[data-guest-book-drawing]")
        ? node
        : node.closest("[data-guest-book-drawing]")
    ) as HTMLElement | null;
    if (!drawingEl || !spread.contains(drawingEl)) continue;
    if (!isVisibleSheetElement(drawingEl)) continue;

    const box = drawingEl.getBoundingClientRect();
    if (
      x >= box.left &&
      x <= box.right &&
      y >= box.top &&
      y <= box.bottom
    ) {
      return drawingEl;
    }
  }

  return null;
}

export function anchorPositionKey(
  anchorRect: DOMRect,
  spreadRect: DOMRect | null,
): string {
  return [
    anchorRect.left,
    anchorRect.top,
    anchorRect.width,
    anchorRect.height,
    spreadRect?.left ?? "",
    spreadRect?.right ?? "",
  ].join("|");
}

export function buildDrawingHoverTarget(
  el: HTMLElement,
  allowedPages: ReadonlySet<number>,
  pages: GuestBookPageContent[],
  measureSpread: () => DOMRect | null,
  fadeIn?: boolean,
): GuestBookDrawingHoverTarget | null {
  const pageNum = Number(
    el.closest("[data-page-number]")?.getAttribute("data-page-number"),
  );
  if (!allowedPages.has(pageNum)) return null;
  if (!isVisibleSheetElement(el)) return null;

  const anchorRect = drawingAnchorRect(el);
  if (!anchorRect) return null;

  const drawingId = el.dataset.guestBookDrawing;
  const drawing = drawingId ? guestBookDrawingById(pages, drawingId) : null;
  if (!drawing || !pageNum) return null;

  return {
    drawing,
    pageNumber: pageNum,
    anchorRect,
    spreadRect: measureSpread(),
    fadeIn,
  };
}

export function profilePosition(
  anchorRect: DOMRect,
  spreadRect: DOMRect | null,
  side: "left" | "right",
) {
  const centerY = anchorRect.top + anchorRect.height / 2;
  const gap = Math.min(Math.max(12, window.innerWidth * 0.03), 28);

  if (side === "left") {
    return {
      top: centerY,
      left: spreadRect ? spreadRect.left - gap : anchorRect.left - gap,
      transform: "translate(-100%, -50%)",
    };
  }

  return {
    top: centerY,
    left: spreadRect ? spreadRect.right + gap : anchorRect.right + gap,
    transform: "translate(0, -50%)",
  };
}

export function queryDrawingElement(
  spread: HTMLElement,
  pageNumber: number,
  drawingId: string,
): HTMLElement | null {
  return spread.querySelector<HTMLElement>(
    `[data-page-number="${pageNumber}"] [data-guest-book-drawing="${drawingId}"]`,
  );
}

export function refreshDrawingHoverTarget(
  spread: HTMLElement,
  drawing: GuestBookDrawing,
  pageNumber: number,
  measureSpread: () => DOMRect | null,
  fadeIn?: boolean,
): GuestBookDrawingHoverTarget | null {
  const el = queryDrawingElement(spread, pageNumber, drawing.id);
  if (!el || !isVisibleSheetElement(el)) return null;

  const anchorRect = drawingAnchorRect(el);
  if (!anchorRect) return null;

  return {
    drawing,
    pageNumber,
    anchorRect,
    spreadRect: measureSpread(),
    fadeIn,
  };
}
