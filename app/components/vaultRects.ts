import {
  CARTRIDGE_CARD_H,
  CARTRIDGE_CARD_W,
  CARTRIDGE_FAN_SCALE,
  CARTRIDGE_SCATTER,
} from "./vaultCartridgeLayout";

export const VAULT_PILE_MARGIN_PX = 54;
const VAULT_MAT_OUTER_GROW_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

export const VAULT_ARTIFACT_Z_BASE = 46;

/** Above collapsed vault piles and site chrome (header, nav); below expand overlays. */
export const VAULT_NAV_Z_INDEX = 65;

export function vaultOverlayZIndex(artifactZ: number) {
  return 70 + (artifactZ - VAULT_ARTIFACT_Z_BASE);
}

export const VAULT_OVERLAY_BACKDROP_COLOR =
  "color-mix(in srgb, var(--background) 25%, transparent)";

export const VAULT_OVERLAY_BACKDROP_TRANSITION =
  "opacity 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), backdrop-filter 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), -webkit-backdrop-filter 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)";

export const VAULT_OVERLAY_BACKDROP_BUTTON_CLASS =
  "absolute inset-0 cursor-default appearance-none border-0 p-0 outline-none focus:outline-none";

export function vaultOverlayBackdropStyle(visible: boolean) {
  return {
    opacity: visible ? 1 : 0,
    backgroundColor: VAULT_OVERLAY_BACKDROP_COLOR,
    WebkitBackdropFilter: visible ? "blur(4px)" : "blur(0px)",
    backdropFilter: visible ? "blur(4px)" : "blur(0px)",
    transition: VAULT_OVERLAY_BACKDROP_TRANSITION,
  };
}

export const WIP_STICKER_MAX_WIDTH_PX = 140;
const WIP_STICKER_ASPECT = 1702 / 2400;

export function rectsOverlap(a: DOMRect, b: DOMRect, pad = 0): boolean {
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

export function vaultStackBounds(
  maxWidth: number,
  maxHeight: number,
  pileScale = 1,
) {
  const margin = VAULT_PILE_MARGIN_PX * pileScale;
  return {
    w: maxWidth + 2 * margin + VAULT_MAT_OUTER_GROW_PX,
    h: maxHeight + 2 * margin + VAULT_MAT_OUTER_GROW_PX,
  };
}

export const VAULT_BOOK_SIZE = { w: 300, h: 400 } as const;

export const VAULT_BOOK_SPINE_W = Math.round((VAULT_BOOK_SIZE.w * 40) / 750);

export const VAULT_COLLAPSED_SCALE_MIN = 0.56;
export const VAULT_COLLAPSED_SCALE_MAX = 1;
export const VAULT_COLLAPSED_SCALE_VP_MIN = 320;
export const VAULT_RESPONSIVE_BREAKPOINT = 768;
export const VAULT_COLLAPSED_SCALE_SHRINK = 0.92;

function collapsedScaleForSpan(span: number) {
  const t = Math.max(
    0,
    Math.min(
      1,
      (span - VAULT_COLLAPSED_SCALE_VP_MIN) /
        (VAULT_RESPONSIVE_BREAKPOINT - VAULT_COLLAPSED_SCALE_VP_MIN),
    ),
  );
  return VAULT_COLLAPSED_SCALE_MIN + t * (VAULT_COLLAPSED_SCALE_MAX - VAULT_COLLAPSED_SCALE_MIN);
}

export function vaultCollapsedScale(viewportW: number, viewportH?: number) {
  if (viewportW >= VAULT_RESPONSIVE_BREAKPOINT) return VAULT_COLLAPSED_SCALE_MAX;
  const span =
    viewportH != null ? Math.min(viewportW, viewportH) : viewportW;
  return collapsedScaleForSpan(span);
}

export function vaultBookClosedScale(viewportW: number, pileScale?: number) {
  return VAULT_BOOK_CLOSED_BASE_SCALE * (pileScale ?? vaultCollapsedScale(viewportW));
}

const VAULT_BOOK_OPEN_MARGIN_PX = 16;
const VAULT_BOOK_OPEN_SCALE_MIN = 0.52;
const VAULT_BOOK_OPEN_SCALE_MAX = 1;

export function vaultBookOpenScale(viewportW: number, viewportH: number) {
  const maxW = viewportW - 2 * VAULT_BOOK_OPEN_MARGIN_PX;
  const maxH = viewportH - 2 * VAULT_BOOK_OPEN_MARGIN_PX;
  const fit = Math.min(
    maxW / (2 * VAULT_BOOK_SIZE.w),
    maxH / VAULT_BOOK_SIZE.h,
  );
  return Math.max(
    VAULT_BOOK_OPEN_SCALE_MIN,
    Math.min(VAULT_BOOK_OPEN_SCALE_MAX, fit),
  );
}

export function vaultBookOpenLayout(
  viewportW: number,
  viewportH: number,
  footprintW: number,
  footprintH: number,
) {
  const bookInsetX = (footprintW - VAULT_BOOK_SIZE.w) / 2;
  return {
    x: viewportW / 2 - bookInsetX,
    y: viewportH / 2 - footprintH / 2,
  };
}

const VAULT_BOOK_CLOSED_BASE_SCALE = 0.5;
const VAULT_BOOK_FOOTPRINT_PAD_PX = 50;
const CARTRIDGE_SHADOW_BLEED_PX = 44;

export function vaultCartridgeFanScale(viewportW: number, pileScale?: number) {
  return CARTRIDGE_FAN_SCALE * (pileScale ?? vaultCollapsedScale(viewportW));
}

export function vaultCartridgeBounds(viewportW: number, pileScale?: number) {
  const scale = pileScale ?? vaultCollapsedScale(viewportW);
  const fanScale = vaultCartridgeFanScale(viewportW, scale);
  const cardW = CARTRIDGE_CARD_W * fanScale;
  const cardH = CARTRIDGE_CARD_H * fanScale;
  const maxOx = Math.max(...CARTRIDGE_SCATTER.map((s) => Math.abs(s.ox))) * scale;
  const maxOy = Math.max(...CARTRIDGE_SCATTER.map((s) => Math.abs(s.oy))) * scale;
  const shadowBleed = CARTRIDGE_SHADOW_BLEED_PX * scale;
  return {
    w: Math.ceil(cardW + 2 * maxOx + 2 * shadowBleed),
    h: Math.ceil(cardH + 2 * maxOy + 2 * shadowBleed),
  };
}

export function vaultBookBounds(viewportW: number, pileScale?: number) {
  const scale = pileScale ?? vaultCollapsedScale(viewportW);
  const closedScale = vaultBookClosedScale(viewportW, scale);
  const footprintPad = VAULT_BOOK_FOOTPRINT_PAD_PX * scale;
  const w =
    Math.ceil((VAULT_BOOK_SIZE.w + VAULT_BOOK_SPINE_W) * closedScale) +
    footprintPad;
  const h = Math.ceil(VAULT_BOOK_SIZE.h * closedScale);
  return { w, h };
}

export function wipStickerBounds() {
  const w = Math.min(window.innerWidth * 0.125, WIP_STICKER_MAX_WIDTH_PX);
  const h = w * WIP_STICKER_ASPECT;
  return { w, h };
}

export function clampVaultDragPosition(x: number, y: number, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, vw - w)),
    y: Math.min(Math.max(0, y), Math.max(0, vh - h)),
  };
}

export function clampVaultDragShellPosition(
  shellX: number,
  shellY: number,
  contentW: number,
  contentH: number,
  contentInsetX: number,
  contentInsetY: number,
) {
  const c = clampVaultDragPosition(
    shellX + contentInsetX,
    shellY + contentInsetY,
    contentW,
    contentH,
  );
  return { x: c.x - contentInsetX, y: c.y - contentInsetY };
}

export function vaultPictureDragClamp(
  shellX: number,
  shellY: number,
  maxWidth: number,
  maxHeight: number,
) {
  const innerW = maxWidth + 2 * VAULT_PILE_MARGIN_PX + VAULT_MAT_OUTER_GROW_PX;
  const innerH = maxHeight + 2 * VAULT_PILE_MARGIN_PX + VAULT_MAT_OUTER_GROW_PX;
  return clampVaultDragShellPosition(
    shellX,
    shellY,
    maxWidth,
    maxHeight,
    (innerW - maxWidth) / 2,
    (innerH - maxHeight) / 2,
  );
}

export function vaultCartridgeDragClamp(
  shellX: number,
  shellY: number,
  viewportW: number,
  footprintW: number,
  footprintH: number,
) {
  const fanScale = vaultCartridgeFanScale(viewportW);
  const fanCardW = CARTRIDGE_CARD_W * fanScale;
  const fanCardH = CARTRIDGE_CARD_H * fanScale;
  return clampVaultDragShellPosition(
    shellX,
    shellY,
    fanCardW,
    fanCardH,
    footprintW / 2 - fanCardW / 2,
    footprintH / 2 - fanCardH / 2,
  );
}

export function clampVaultPosition(x: number, y: number, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = VIEWPORT_MARGIN_PX;
  return {
    x: Math.min(Math.max(m, x), Math.max(m, vw - w - m)),
    y: Math.min(Math.max(m, y), Math.max(m, vh - h - m)),
  };
}

export function reclampVaultCenter(
  cx: number,
  cy: number,
  w: number,
  h: number,
): readonly [number, number] {
  const c = clampVaultPosition(cx - w / 2, cy - h / 2, w, h);
  return [Math.round(c.x + w / 2), Math.round(c.y + h / 2)] as const;
}

export function reclampWidgetPosition(
  x: number,
  y: number,
  w: number,
  h: number,
): readonly [number, number] {
  const c = clampVaultPosition(x, y, w, h);
  return [Math.round(c.x), Math.round(c.y)] as const;
}
