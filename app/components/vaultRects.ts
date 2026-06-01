import {
  boxFromTopLeft,
  fitsSpawnPlacement,
} from "./uiPlacement";
import {
  CARTRIDGE_CARD_H,
  CARTRIDGE_CARD_W,
  CARTRIDGE_FAN_SCALE,
} from "./vaultCartridgeLayout";

export const VAULT_PILE_MARGIN_PX = 54;
const VAULT_MAT_OUTER_GROW_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

export const VAULT_ARTIFACT_Z_BASE = 46;

/** Above collapsed vault piles (portaled to body), below expand overlays. */
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

export function vaultStackBounds(maxWidth: number, maxHeight: number) {
  return {
    w: maxWidth + 2 * VAULT_PILE_MARGIN_PX + VAULT_MAT_OUTER_GROW_PX,
    h: maxHeight + 2 * VAULT_PILE_MARGIN_PX + VAULT_MAT_OUTER_GROW_PX,
  };
}

export const VAULT_BOOK_SIZE = { w: 300, h: 400 } as const;

export const VAULT_BOOK_SPINE_W = Math.round((VAULT_BOOK_SIZE.w * 40) / 750);

const VAULT_BOOK_CLOSED_SCALE = 0.5;
const VAULT_BOOK_FOOTPRINT_PAD_PX = 50;

export function vaultBookBounds() {
  const w =
    Math.ceil((VAULT_BOOK_SIZE.w + VAULT_BOOK_SPINE_W) * VAULT_BOOK_CLOSED_SCALE) +
    VAULT_BOOK_FOOTPRINT_PAD_PX;
  const h = Math.ceil(VAULT_BOOK_SIZE.h * VAULT_BOOK_CLOSED_SCALE);
  return { w, h };
}

const VAULT_CARTRIDGE_SCATTER_PAD = { w: 90, h: 70 };

export function vaultCartridgeBounds() {
  return {
    w:
      Math.ceil(CARTRIDGE_CARD_W * CARTRIDGE_FAN_SCALE) +
      VAULT_CARTRIDGE_SCATTER_PAD.w,
    h:
      Math.ceil(CARTRIDGE_CARD_H * CARTRIDGE_FAN_SCALE) +
      VAULT_CARTRIDGE_SCATTER_PAD.h,
  };
}

export function wipStickerBounds() {
  const w = Math.min(window.innerWidth * 0.125, WIP_STICKER_MAX_WIDTH_PX);
  const h = w * WIP_STICKER_ASPECT;
  return { w, h };
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

function pickRandomTopLeft(
  w: number,
  h: number,
  peerId?: string,
): { x: number; y: number } {
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minX = margin;
  const maxX = vw - margin - w;
  const minY = margin;
  const maxY = vh - margin - h;

  if (maxX < minX || maxY < minY) {
    return clampVaultPosition((vw - w) / 2, (vh - h) / 2, w, h);
  }

  for (let i = 0; i < 80; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const c = clampVaultPosition(x, y, w, h);
    if (fitsSpawnPlacement(boxFromTopLeft(c.x, c.y, w, h), peerId)) return c;
  }

  const corners: [number, number][] = [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ];
  for (const [x, y] of corners) {
    const c = clampVaultPosition(x, y, w, h);
    if (fitsSpawnPlacement(boxFromTopLeft(c.x, c.y, w, h), peerId)) return c;
  }

  for (const step of [24, 12, 8, 4]) {
    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const c = clampVaultPosition(x, y, w, h);
        if (fitsSpawnPlacement(boxFromTopLeft(c.x, c.y, w, h), peerId)) return c;
      }
    }
  }

  return clampVaultPosition(maxX, minY, w, h);
}

export function pickRandomWidgetPosition(
  w: number,
  h: number,
  peerId?: string,
): readonly [number, number] {
  const c = pickRandomTopLeft(w, h, peerId);
  return [Math.round(c.x), Math.round(c.y)] as const;
}

export function pickRandomVaultCenter(
  w: number,
  h: number,
  peerId?: string,
): readonly [number, number] {
  const c = pickRandomTopLeft(w, h, peerId);
  return [Math.round(c.x + w / 2), Math.round(c.y + h / 2)] as const;
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
