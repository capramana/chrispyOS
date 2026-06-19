import {
  fitsSpawnPeers,
  getSpawnPeerRects,
  HERO_SPAWN_BUFFER_PX,
  NAV_SPAWN_BUFFER_PX,
  SPAWN_PEER_GAP_PX,
  VAULT_SPAWN_MARGIN_PX,
} from "./uiPlacement";
import { fits, overlaps, placeRectangles, rectAt, type Rect } from "./placement";
import { vaultCollapsedScale } from "./vaultRects";

const CHROME_SELECTORS = [
  { selector: "[data-site-header]", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: ".navbar-pill", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: "[data-site-footer-corner]", buffer: NAV_SPAWN_BUFFER_PX },
] as const;

const HERO_SELECTORS = [
  { selector: "[data-hero-heading]", buffer: HERO_SPAWN_BUFFER_PX },
  { selector: "[data-hero-description]", buffer: HERO_SPAWN_BUFFER_PX },
] as const;

function measureBlockedRects(includeHero: boolean): Rect[] {
  const selectors = includeHero
    ? [...CHROME_SELECTORS, ...HERO_SELECTORS]
    : CHROME_SELECTORS;
  const rects: Rect[] = [];
  for (const { selector, buffer } of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      rects.push({
        left: r.left - buffer,
        top: r.top - buffer,
        right: r.right + buffer,
        bottom: r.bottom + buffer,
      });
    }
  }
  return rects;
}

function spawnPlaceOptions(viewportW: number, viewportH: number) {
  const scale = vaultCollapsedScale(viewportW, viewportH);
  return {
    margin: Math.max(4, Math.round(VAULT_SPAWN_MARGIN_PX * scale)),
    gap: SPAWN_PEER_GAP_PX,
    step: Math.max(4, Math.round(16 * scale)),
  };
}

export type VaultStackItem = { id: string; w: number; h: number };

const VAULT_STACK_PEER_IDS = [
  "vault-pictures",
  "vault-book",
  "vault-cartridges",
  "vault-postit",
] as const;

function stackCentersFromPlacement(
  items: readonly VaultStackItem[],
  positions: Map<string, { x: number; y: number }>,
) {
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

export function placeVaultStacks(
  items: readonly VaultStackItem[],
  viewportW = window.innerWidth,
  viewportH = window.innerHeight,
  { reserveHero = true }: { reserveHero?: boolean } = {},
) {
  const blocked = [
    ...measureBlockedRects(reserveHero),
    ...getSpawnPeerRects(...VAULT_STACK_PEER_IDS),
  ];
  const positions = placeRectangles(
    items,
    viewportW,
    viewportH,
    blocked,
    spawnPlaceOptions(viewportW, viewportH),
  );
  return stackCentersFromPlacement(items, positions);
}

export function vaultStacksValid(
  items: readonly (VaultStackItem & { cx: number; cy: number })[],
  viewportW: number,
  excludePeerId?: string,
  reserveHero = true,
): boolean {
  const blocked = measureBlockedRects(reserveHero);
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
    ...measureBlockedRects(true),
    ...(excludePeerId ? getSpawnPeerRects(excludePeerId) : getSpawnPeerRects()),
  ];
  const result = placeRectangles([{ id: "widget", w, h }], vw, vh, blocked, {
    ...spawnPlaceOptions(vw, vh),
    margin: VAULT_SPAWN_MARGIN_PX,
  });
  const pos = result.get("widget");
  return [
    Math.round(pos?.x ?? VAULT_SPAWN_MARGIN_PX),
    Math.round(pos?.y ?? VAULT_SPAWN_MARGIN_PX),
  ] as const;
}
