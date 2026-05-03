"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import VaultPictureStack, { type VaultPictureItem } from "./VaultPictureStack";
import { rectsOverlap } from "./vaultRects";

/** ~half prior on-screen envelope; portrait hits height, landscape hits width first */
const VAULT_FOOTPRINT = { maxWidth: 140, maxHeight: 175 } as const;

/** One draggable entity per stack type (pictures, books, text, …). */
const STACK_IDS = ["stack-pictures"] as const;

const INITIAL_STACK: Record<string, number> = Object.fromEntries(
  STACK_IDS.map((id, i) => [id, i + 1]),
) as Record<string, number>;

/** Bottom → top in the pile (last entry = top face, least tilt). */
const PICTURE_ITEMS: VaultPictureItem[] = [
  {
    id: "picture-falcon-1",
    src: "/vault/artifact-1.png",
    alt: "Falcon 1 debris hangar, 2006",
    maxWidth: 100,
    maxHeight: 125,
  },
  {
    id: "picture-jobs-apple-return",
    src: "/vault/artifact-7.png",
    alt: "Steve Jobs shortly after returning to Apple",
  },
  {
    id: "picture-yeltsin-houston",
    src: "/vault/artifact-2.png",
    alt: "Boris Yeltsin in a Houston supermarket, 1989",
  },
];

function collectRects(
  nodes: Record<string, HTMLDivElement | null>,
): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  for (const id of STACK_IDS) {
    const el = nodes[id];
    if (el) m.set(id, el.getBoundingClientRect());
  }
  return m;
}

export default function VaultArtifacts() {
  /** Viewport anchor for the picture pile (center of the stack, not top-left). */
  const stackPosition = useMemo(() => {
    if (typeof window === "undefined") return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return [Math.round(vw * 0.32), Math.round(vh * 0.38)] as const;
  }, []);

  const nodesRef = useRef<Record<string, HTMLDivElement | null>>(
    Object.fromEntries(STACK_IDS.map((id) => [id, null])) as Record<
      string,
      HTMLDivElement | null
    >,
  );
  const stackRef = useRef<Record<string, number>>({ ...INITIAL_STACK });
  const [stack, setStack] = useState(INITIAL_STACK);
  const seqRef = useRef(STACK_IDS.length + 1);
  const deferredRef = useRef(new Map<string, Set<string>>());

  useLayoutEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const promote = useCallback((id: string) => {
    const n = seqRef.current++;
    setStack((s) => ({ ...s, [id]: n }));
  }, []);

  const tryReleaseDeferred = useCallback(
    (id: string) => {
      const blocked = deferredRef.current.get(id);
      if (!blocked || blocked.size === 0) return;
      const rects = collectRects(nodesRef.current);
      const ra = rects.get(id);
      if (!ra) return;
      for (const b of blocked) {
        const rb = rects.get(b);
        if (rb && rectsOverlap(ra, rb)) return;
      }
      deferredRef.current.delete(id);
      promote(id);
    },
    [promote],
  );

  const retryAllDeferred = useCallback(() => {
    for (const id of [...deferredRef.current.keys()]) {
      tryReleaseDeferred(id);
    }
  }, [tryReleaseDeferred]);

  const onInteractionStart = useCallback(
    (id: string) => {
      const rects = collectRects(nodesRef.current);
      const ra = rects.get(id);
      if (!ra) return;
      const st = stackRef.current;
      const blocked = new Set<string>();
      for (const other of STACK_IDS) {
        if (other === id) continue;
        const rb = rects.get(other);
        if (!rb) continue;
        if (!rectsOverlap(ra, rb)) continue;
        if ((st[other] ?? 0) > (st[id] ?? 0)) blocked.add(other);
      }
      if (blocked.size === 0) {
        deferredRef.current.delete(id);
        promote(id);
      } else {
        deferredRef.current.set(id, blocked);
      }
    },
    [promote],
  );

  useLayoutEffect(() => {
    retryAllDeferred();
  }, [stack, retryAllDeferred]);

  const registerNode = useCallback((id: string, el: HTMLDivElement | null) => {
    nodesRef.current[id] = el;
  }, []);

  const zFor = useCallback(
    (stackId: (typeof STACK_IDS)[number]) => {
      const sorted = [...STACK_IDS].sort(
        (a, b) => (stack[a] ?? 0) - (stack[b] ?? 0),
      );
      return 46 + sorted.indexOf(stackId);
    },
    [stack],
  );

  if (!stackPosition) return null;

  const [left, top] = stackPosition;

  return (
    <VaultPictureStack
      id="stack-pictures"
      zIndex={zFor("stack-pictures")}
      registerNode={registerNode}
      onInteractionStart={onInteractionStart}
      onPositionChanged={retryAllDeferred}
      items={PICTURE_ITEMS}
      initialLeft={left}
      initialTop={top}
      maxWidth={VAULT_FOOTPRINT.maxWidth}
      maxHeight={VAULT_FOOTPRINT.maxHeight}
    />
  );
}
