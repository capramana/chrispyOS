"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import VaultPictureStack, { type VaultPictureItem } from "./VaultPictureStack";
import {
  pickRandomVaultCenter,
  reclampVaultCenter,
  rectsOverlap,
  vaultStackBounds,
} from "./vaultRects";
import { boxFromTopLeft, registerSpawnPeer } from "./uiPlacement";

/** ~half prior on-screen envelope; portrait hits height, landscape hits width first */
const VAULT_FOOTPRINT = { maxWidth: 140, maxHeight: 175 } as const;

/** One draggable entity per stack type (pictures, books, text, …). */
const STACK_IDS = ["stack-pictures"] as const;
const VAULT_SPAWN_PEER_ID = "vault-pictures";

const INITIAL_STACK: Record<string, number> = Object.fromEntries(
  STACK_IDS.map((id, i) => [id, i + 1]),
) as Record<string, number>;

// Stacked visibility: first three items in this array match `VIS` in `VaultPictureStack` (prototype).
const PICTURE_ITEMS: VaultPictureItem[] = [
  {
    id: "picture-buffett-munger-2022",
    src: "/vault/artifact-buffett-munger-final-meeting-2022.png",
    alt: "Warren Buffett and Charlie Munger seated at a table with See's Candies boxes and microphones",
    caption: "Buffett and Munger's final shareholder meeting together",
    captionYear: "2022",
    captionUrl:
      "https://buffett.cnbc.com/video/2022/05/02/2022-annual-meeting-highlight-reel.html",
  },
  {
    id: "picture-4",
    src: "/vault/artifact-4.png",
    alt: "Christopher Nolan filming Dunkirk, camera crane over water",
    caption: "Nolan in the water while filming Dunkirk",
    captionYear: "2016",
    captionUrl: "https://www.amazon.com/Making-Dunkirk-James-Mottram/dp/1683831071",
  },
  {
    id: "picture-5",
    src: "/vault/artifact-5.png",
    alt: "Apollo astronaut and US flag on the Moon",
    caption: "Aldrin salutes the flag",
    captionYear: "1969",
    captionUrl:
      "https://www.nasa.gov/history/flag-day-flying-high-the-stars-and-stripes-in-space/",
  },
  {
    id: "picture-6",
    src: "/vault/artifact-6.png",
    alt: "Lee Sedol at the Go board during the AlphaGo match",
    caption: "Deepmind's AlphaGo vs. Lee Sedol",
    captionYear: "2016",
    captionUrl:
      "https://blog.google/innovation-and-ai/products/alphagos-ultimate-challenge/",
  },
  {
    id: "picture-hamming-nps-learning",
    src: "/vault/artifact-hamming-nps.png",
    alt: "Richard Hamming at a lectern in an auditorium, crew preparing to record, 1995",
    caption: "NPS prepares to tape Hamming's lecture",
    captionYear: "1995",
    captionUrl: "https://library.nps.edu/richard-w-hamming",
  },
  {
    id: "picture-falcon-1",
    src: "/vault/artifact-1.png",
    alt: "Falcon 1 debris hangar, 2006",
    maxWidth: 100,
    maxHeight: 125,
    caption: "Musk stares at Falcon 1 debris",
    captionYear: "2006",
    captionUrl:
      "https://www.reddit.com/r/elonmusk/comments/1msu12c/elon_musk_and_team_examining_the_debris_from/",
  },
  {
    id: "picture-jobs-apple-return",
    src: "/vault/artifact-7.png",
    alt: "Steve Jobs shortly after returning to Apple",
    caption: "Jobs after returning to Apple",
    captionYear: "1997",
    captionUrl: "https://book.stevejobsarchive.com/",
  },
  {
    id: "picture-yeltsin-houston",
    src: "/vault/artifact-2.png",
    alt: "Boris Yeltsin in a Houston supermarket, 1989",
    caption: "Supreme Soviet, Yeltsin in awe visiting a Texan supermarket",
    captionYear: "1989",
    captionUrl:
      "https://www.chron.com/neighborhood/bayarea/news/article/When-Boris-Yeltsin-went-grocery-shopping-in-Clear-5759129.php",
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
  const stackPositionRef = useRef<readonly [number, number] | null>(null);
  const [stackPosition, setStackPosition] = useState<
    readonly [number, number] | null
  >(null);

  useLayoutEffect(() => {
    const unregister = registerSpawnPeer(VAULT_SPAWN_PEER_ID, () => {
      const p = stackPositionRef.current;
      if (!p) return null;
      const { w, h } = vaultStackBounds(
        VAULT_FOOTPRINT.maxWidth,
        VAULT_FOOTPRINT.maxHeight,
      );
      return boxFromTopLeft(p[0] - w / 2, p[1] - h / 2, w, h);
    });

    const sync = () => {
      const { w, h } = vaultStackBounds(
        VAULT_FOOTPRINT.maxWidth,
        VAULT_FOOTPRINT.maxHeight,
      );
      setStackPosition((prev) => {
        if (!prev) {
          const next = pickRandomVaultCenter(w, h, VAULT_SPAWN_PEER_ID);
          stackPositionRef.current = next;
          return next;
        }
        const next = reclampVaultCenter(prev[0], prev[1], w, h);
        if (next[0] === prev[0] && next[1] === prev[1]) return prev;
        stackPositionRef.current = next;
        return next;
      });
    };
    sync();
    window.addEventListener("resize", sync);
    return () => {
      unregister();
      window.removeEventListener("resize", sync);
    };
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
