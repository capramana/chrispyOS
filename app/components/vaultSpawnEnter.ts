import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

const MOTION_MS = 280;
const OPACITY_MS = 200;
const EASE = "cubic-bezier(0.34, 1.15, 0.64, 1)";

export const VAULT_SPAWN_ENTER_MS = MOTION_MS;

export const VAULT_SPAWN_ENTER_TRANSITION =
  `transform ${MOTION_MS}ms ${EASE}, opacity ${OPACITY_MS}ms ease`;

export const VAULT_SPAWN_ENTER_POSITION_TRANSITION =
  `transform ${MOTION_MS}ms ${EASE}, left ${MOTION_MS}ms ${EASE}, top ${MOTION_MS}ms ${EASE}, opacity ${OPACITY_MS}ms ease, box-shadow ${OPACITY_MS}ms ease`;

export function vaultSpawnLayerTransition(
  entered: boolean,
  settled: boolean,
  motionActive: boolean,
  withPosition = false,
): string | undefined {
  if (!entered || motionActive) return "none";
  if (!settled) {
    return withPosition
      ? VAULT_SPAWN_ENTER_POSITION_TRANSITION
      : VAULT_SPAWN_ENTER_TRANSITION;
  }
  return undefined;
}

type SpawnStore = {
  entered: boolean;
  settled: boolean;
  listeners: Set<() => void>;
  rafId: number;
  timerId: number;
};

function createSpawnStore(): SpawnStore {
  return {
    entered: false,
    settled: false,
    listeners: new Set(),
    rafId: 0,
    timerId: 0,
  };
}

function start(store: SpawnStore) {
  if (store.entered || store.rafId) return;
  store.rafId = requestAnimationFrame(() => {
    store.rafId = requestAnimationFrame(() => {
      store.rafId = 0;
      store.entered = true;
      store.listeners.forEach((listener) => listener());
      store.timerId = window.setTimeout(() => {
        store.timerId = 0;
        store.settled = true;
        store.listeners.forEach((listener) => listener());
      }, VAULT_SPAWN_ENTER_MS);
    });
  });
}

function dispose(store: SpawnStore) {
  if (store.rafId) cancelAnimationFrame(store.rafId);
  if (store.timerId) window.clearTimeout(store.timerId);
  store.rafId = 0;
  store.timerId = 0;
  store.entered = false;
  store.settled = false;
}

export function useVaultSpawnEnter() {
  const store = useMemo(() => createSpawnStore(), []);

  const subscribe = useCallback((onStoreChange: () => void) => {
    store.listeners.add(onStoreChange);
    start(store);
    return () => store.listeners.delete(onStoreChange);
  }, [store]);

  useEffect(() => () => dispose(store), [store]);

  const entered = useSyncExternalStore(
    subscribe,
    () => store.entered,
    () => false,
  );
  const settled = useSyncExternalStore(
    subscribe,
    () => store.settled,
    () => false,
  );

  return { entered, settled };
}
