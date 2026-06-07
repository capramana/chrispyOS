export const SPAWN_PEER_GAP_PX = 8;
export const HERO_SPAWN_BUFFER_PX = 12;
export const GRAFFITI_HERO_BUFFER_PX = 28;
/** Viewport edge inset for vault / widget spawn search (matches desktop picker). */
export const VAULT_SPAWN_MARGIN_PX = 16;
export const NAV_SPAWN_BUFFER_PX = 20;

const NAV_UI_SPAWN_CHECKS = [
  { selector: ".navbar-pill", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: ".transition-blur-corner", buffer: NAV_SPAWN_BUFFER_PX },
  { selector: ".transition-blur-logo", buffer: NAV_SPAWN_BUFFER_PX },
] as const;

export type PlacementBox = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SpawnElementCheck = { selector: string; buffer: number };

export function spawnElementChecks(heroBuffer: number): SpawnElementCheck[] {
  return [
    { selector: "[data-hero-heading]", buffer: heroBuffer },
    { selector: "[data-hero-description]", buffer: heroBuffer },
    ...NAV_UI_SPAWN_CHECKS,
  ];
}

export const VAULT_SPAWN_CHECKS = spawnElementChecks(HERO_SPAWN_BUFFER_PX);
export const GRAFFITI_SPAWN_CHECKS = spawnElementChecks(GRAFFITI_HERO_BUFFER_PX);

export function eventTargetWithin(
  target: EventTarget | null,
  selector: string,
) {
  return target instanceof Element && target.closest(selector) != null;
}

export function boxFromTopLeft(
  x: number,
  y: number,
  w: number,
  h: number,
): PlacementBox {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

export function boxesOverlapBuffered(
  a: PlacementBox,
  b: { top: number; bottom: number; left: number; right: number },
  buffer: number,
): boolean {
  return (
    a.left < b.right + buffer &&
    a.right > b.left - buffer &&
    a.top < b.bottom + buffer &&
    a.bottom > b.top - buffer
  );
}

export function fitsSpawnUi(
  box: PlacementBox,
  checks: SpawnElementCheck[] = VAULT_SPAWN_CHECKS,
): boolean {
  for (const { selector, buffer } of checks) {
    for (const el of document.querySelectorAll(selector)) {
      if (boxesOverlapBuffered(box, el.getBoundingClientRect(), buffer)) {
        return false;
      }
    }
  }
  return true;
}

const spawnPeers = new Map<string, () => PlacementBox | null>();

export function registerSpawnPeer(
  id: string,
  getBox: () => PlacementBox | null,
): () => void {
  spawnPeers.set(id, getBox);
  return () => spawnPeers.delete(id);
}

export function getSpawnPeerRects(...excludeIds: string[]) {
  const exclude = new Set(excludeIds);
  const boxes: PlacementBox[] = [];
  for (const [id, getBox] of spawnPeers) {
    if (exclude.has(id)) continue;
    const box = getBox();
    if (box) boxes.push(box);
  }
  return boxes;
}

function getSpawnPeerBoxes(excludeId?: string) {
  return getSpawnPeerRects(...(excludeId ? [excludeId] : []));
}

export function fitsSpawnPeers(box: PlacementBox, excludeId?: string): boolean {
  for (const peer of getSpawnPeerBoxes(excludeId)) {
    if (boxesOverlapBuffered(box, peer, SPAWN_PEER_GAP_PX)) return false;
  }
  return true;
}

export function fitsSpawnPlacement(
  box: PlacementBox,
  excludePeerId?: string,
): boolean {
  return fitsSpawnUi(box) && fitsSpawnPeers(box, excludePeerId);
}
