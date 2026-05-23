export const SPAWN_PEER_GAP_PX = 8;
export const HERO_SPAWN_BUFFER_PX = 12;
export const GRAFFITI_HERO_BUFFER_PX = 28;

const NAV_UI_SPAWN_CHECKS = [
  { selector: ".navbar-pill", buffer: 20 },
  { selector: ".transition-blur-corner", buffer: 20 },
  { selector: ".transition-blur-logo", buffer: 20 },
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
    { selector: "#main-heading", buffer: heroBuffer },
    { selector: "#main-description", buffer: heroBuffer },
    ...NAV_UI_SPAWN_CHECKS,
  ];
}

export const VAULT_SPAWN_CHECKS = spawnElementChecks(HERO_SPAWN_BUFFER_PX);
export const GRAFFITI_SPAWN_CHECKS = spawnElementChecks(GRAFFITI_HERO_BUFFER_PX);

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

function getSpawnPeerBoxes(excludeId?: string): PlacementBox[] {
  const boxes: PlacementBox[] = [];
  for (const [id, getBox] of spawnPeers) {
    if (excludeId && id === excludeId) continue;
    const box = getBox();
    if (box) boxes.push(box);
  }
  return boxes;
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
