import {
  fitsSpawnPeers,
  getSpawnPeerRects,
  HERO_SPAWN_BUFFER_PX,
  NAV_SPAWN_BUFFER_PX,
  SPAWN_PEER_GAP_PX,
  VAULT_SPAWN_MARGIN_PX,
} from "./uiPlacement";
import { fits, overlaps, placeRectangles, rectAt, type Rect } from "./placement";
import { VAULT_RESPONSIVE_BREAKPOINT } from "./vaultRects";

const MOBILE_HERO_BUFFER_PX = 28;

const BLOCKED_SELECTORS = [
  { selector: "[data-site-header]", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: "#main-heading", buffer: HERO_SPAWN_BUFFER_PX },
  { selector: "#main-description", buffer: HERO_SPAWN_BUFFER_PX },
  { selector: ".navbar-pill", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: "[data-site-footer-corner]", buffer: NAV_SPAWN_BUFFER_PX },
] as const;

function measureBlockedRects(viewportW: number): Rect[] {
  const heroBuffer =
    viewportW < VAULT_RESPONSIVE_BREAKPOINT
      ? MOBILE_HERO_BUFFER_PX
      : HERO_SPAWN_BUFFER_PX;

  const rects: Rect[] = [];
  for (const { selector, buffer } of BLOCKED_SELECTORS) {
    const useBuffer =
      selector === "#main-heading" || selector === "#main-description"
        ? heroBuffer
        : buffer;
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      rects.push({
        left: r.left - useBuffer,
        top: r.top - useBuffer,
        right: r.right + useBuffer,
        bottom: r.bottom + useBuffer,
      });
    }
  }
  return rects;
}

export type VaultStackItem = { id: string; w: number; h: number };

const VAULT_STACK_PEER_IDS = [
  "vault-pictures",
  "vault-book",
  "vault-cartridges",
] as const;

export function placeVaultStacks(
  items: readonly VaultStackItem[],
): Map<string, readonly [number, number]> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const blocked = [
    ...measureBlockedRects(vw),
    ...getSpawnPeerRects(...VAULT_STACK_PEER_IDS),
  ];

  const positions = placeRectangles(items, vw, vh, blocked, {
    margin: VAULT_SPAWN_MARGIN_PX,
    gap: SPAWN_PEER_GAP_PX,
    step: vw < VAULT_RESPONSIVE_BREAKPOINT ? 12 : 16,
  });

  const centers = new Map<string, readonly [number, number]>();
  for (const item of items) {
    const pos = positions.get(item.id);
    if (!pos) continue;
    centers.set(item.id, [
      Math.round(pos.x + item.w / 2),
      Math.round(pos.y + item.h / 2),
    ] as const);
  }
  return centers;
}

export function vaultStacksValid(
  items: readonly (VaultStackItem & { cx: number; cy: number })[],
  viewportW: number,
  excludePeerId?: string,
): boolean {
  const blocked = measureBlockedRects(viewportW);
  const placed: Rect[] = [];

  for (const { w, h, cx, cy } of items) {
    const box = rectAt(cx - w / 2, cy - h / 2, w, h);
    if (!fits(box, blocked, SPAWN_PEER_GAP_PX)) return false;
    if (!fitsSpawnPeers(box, excludePeerId)) return false;
    for (const peer of placed) {
      if (overlaps(box, peer, SPAWN_PEER_GAP_PX)) return false;
    }
    placed.push(box);
  }
  return true;
}

export function pickWidgetPosition(
  w: number,
  h: number,
  excludePeerId?: string,
): readonly [number, number] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const blocked = [
    ...measureBlockedRects(vw),
    ...(excludePeerId ? getSpawnPeerRects(excludePeerId) : getSpawnPeerRects()),
  ];
  const result = placeRectangles([{ id: "widget", w, h }], vw, vh, blocked, {
    margin: VAULT_SPAWN_MARGIN_PX,
    gap: SPAWN_PEER_GAP_PX,
  });
  const pos = result.get("widget");
  return [
    Math.round(pos?.x ?? VAULT_SPAWN_MARGIN_PX),
    Math.round(pos?.y ?? VAULT_SPAWN_MARGIN_PX),
  ] as const;
}
