export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SizedItem = {
  id: string;
  w: number;
  h: number;
};

export function rectAt(x: number, y: number, w: number, h: number): Rect {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return !(
    a.right + gap <= b.left ||
    a.left - gap >= b.right ||
    a.bottom + gap <= b.top ||
    a.top - gap >= b.bottom
  );
}

export function fits(box: Rect, blocked: readonly Rect[], gap = 0): boolean {
  for (const zone of blocked) {
    if (overlaps(box, zone, gap)) return false;
  }
  return true;
}

export type PlaceOptions = {
  margin?: number;
  gap?: number;
  step?: number;
  randomAttempts?: number;
};

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function placeRectangles(
  items: readonly SizedItem[],
  viewportW: number,
  viewportH: number,
  blocked: readonly Rect[],
  { margin = 16, gap = 8, step = 16, randomAttempts = 80 }: PlaceOptions = {},
): Map<string, { x: number; y: number }> {
  const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  const placed: Rect[] = [];
  const result = new Map<string, { x: number; y: number }>();

  for (const item of sorted) {
    const minX = margin;
    const maxX = viewportW - margin - item.w;
    const minY = margin;
    const maxY = viewportH - margin - item.h;
    if (maxX < minX || maxY < minY) continue;

    const tryAt = (x: number, y: number) => {
      const cx = Math.min(Math.max(minX, x), maxX);
      const cy = Math.min(Math.max(minY, y), maxY);
      const box = rectAt(cx, cy, item.w, item.h);
      return fits(box, [...blocked, ...placed], gap) ? { x: cx, y: cy } : null;
    };

    let pos: { x: number; y: number } | null = null;

    for (let i = 0; i < randomAttempts; i++) {
      pos = tryAt(
        minX + Math.random() * (maxX - minX),
        minY + Math.random() * (maxY - minY),
      );
      if (pos) break;
    }

    const midX = Math.round((minX + maxX) / 2);
    const midY = Math.round((minY + maxY) / 2);
    const anchors: [number, number][] = [
      [minX, minY],
      [maxX, minY],
      [minX, maxY],
      [maxX, maxY],
      [midX, minY],
      [midX, maxY],
      [minX, midY],
      [maxX, midY],
    ];
    shuffleInPlace(anchors);

    if (!pos) {
      for (const [x, y] of anchors) {
        pos = tryAt(x, y);
        if (pos) break;
      }
    }

    if (!pos) {
      outer: for (let y = minY; y <= maxY; y += step) {
        for (let x = minX; x <= maxX; x += step) {
          pos = tryAt(x, y);
          if (pos) break outer;
        }
      }
    }

    if (!pos) continue;

    result.set(item.id, pos);
    placed.push(rectAt(pos.x, pos.y, item.w, item.h));
  }

  return result;
}
