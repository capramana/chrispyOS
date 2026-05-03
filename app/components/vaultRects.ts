export function rectsOverlap(a: DOMRect, b: DOMRect, pad = 0): boolean {
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}
