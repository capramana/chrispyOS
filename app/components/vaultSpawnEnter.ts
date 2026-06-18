import { useEffect, useLayoutEffect, useState } from "react";

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

export function useVaultSpawnEnter() {
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    let alive = true;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (alive) setEntered(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, []);

  useEffect(() => {
    if (!entered) return;
    const id = window.setTimeout(() => setSettled(true), VAULT_SPAWN_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [entered]);

  return { entered, settled };
}
