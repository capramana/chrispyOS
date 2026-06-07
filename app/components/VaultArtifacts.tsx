"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import VaultPictureStack, { type VaultPictureItem } from "./VaultPictureStack";
import VaultBook from "./VaultBook";
import VaultCartridgeStack from "./VaultCartridgeStack";
import { placeVaultStacks, vaultStacksValid } from "./vaultPlacement";
import {
  reclampVaultCenter,
  VAULT_ARTIFACT_Z_BASE,
  vaultBookBounds,
  vaultBookClosedScale,
  vaultBookOpenScale,
  vaultCartridgeBounds,
  vaultCollapsedScale,
  vaultStackBounds,
} from "./vaultRects";
import { boxFromTopLeft, registerSpawnPeer } from "./uiPlacement";

/** One draggable entity per stack type (pictures, books, text, …). */
const STACK_IDS = ["stack-pictures", "stack-books", "stack-cartridges"] as const;

const STACK_SPAWN_PEER: Record<(typeof STACK_IDS)[number], string> = {
  "stack-pictures": "vault-pictures",
  "stack-books": "vault-book",
  "stack-cartridges": "vault-cartridges",
};

const PICTURE_FOOTPRINT = { maxWidth: 140, maxHeight: 175 } as const;

function stackBounds(
  stackId: (typeof STACK_IDS)[number],
  viewportW: number,
) {
  const pileScale = vaultCollapsedScale(viewportW);
  if (stackId === "stack-pictures") {
    return vaultStackBounds(
      PICTURE_FOOTPRINT.maxWidth * pileScale,
      PICTURE_FOOTPRINT.maxHeight * pileScale,
      pileScale,
    );
  }
  if (stackId === "stack-books") return vaultBookBounds(viewportW);
  return vaultCartridgeBounds(viewportW);
}

function stackItems(viewportW: number) {
  return STACK_IDS.map((id) => ({ id, ...stackBounds(id, viewportW) }));
}

type StackPosition = readonly [number, number];
type StackPositions = Partial<Record<(typeof STACK_IDS)[number], StackPosition>>;

function stacksComplete(
  positions: StackPositions,
): positions is Record<(typeof STACK_IDS)[number], StackPosition> {
  return STACK_IDS.every((id) => positions[id] != null);
}

function withCenters(
  items: ReturnType<typeof stackItems>,
  positions: Record<(typeof STACK_IDS)[number], StackPosition>,
) {
  return items.map((item) => {
    const id = item.id as (typeof STACK_IDS)[number];
    const [cx, cy] = positions[id];
    return { ...item, cx, cy };
  });
}

function placeAllStacks(items: ReturnType<typeof stackItems>) {
  const centers = placeVaultStacks(items);
  const next = {} as Record<(typeof STACK_IDS)[number], StackPosition>;
  for (const id of STACK_IDS) {
    const c = centers.get(id);
    if (!c) return null;
    next[id] = c;
  }
  return next;
}

function commitStacks(
  ref: { current: StackPositions },
  placed: Record<(typeof STACK_IDS)[number], StackPosition>,
) {
  for (const id of STACK_IDS) ref.current[id] = placed[id];
}

function readInitialStackPositions(): StackPositions {
  if (typeof window === "undefined") return {};
  const placed = placeAllStacks(stackItems(window.innerWidth));
  return placed ?? {};
}

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

export default function VaultArtifacts() {
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1200, h: 800 },
  );
  const [stackPositions, setStackPositions] = useState<StackPositions>(
    readInitialStackPositions,
  );
  const stackPositionsRef = useRef<StackPositions>(stackPositions);

  useLayoutEffect(() => {
    if (stacksComplete(stackPositions)) {
      commitStacks(
        stackPositionsRef,
        stackPositions as Record<(typeof STACK_IDS)[number], StackPosition>,
      );
    }
    const unregister = STACK_IDS.map((stackId) =>
      registerSpawnPeer(STACK_SPAWN_PEER[stackId], () => {
        const p = stackPositionsRef.current[stackId];
        if (!p) return null;
        const { w, h } = stackBounds(stackId, window.innerWidth);
        return boxFromTopLeft(p[0] - w / 2, p[1] - h / 2, w, h);
      }),
    );

    const sync = () => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      setViewport((current) =>
        current.w === viewportW && current.h === viewportH
          ? current
          : { w: viewportW, h: viewportH },
      );
      setStackPositions((prev) => {
        const items = stackItems(viewportW);
        const needsPlacement =
          !stacksComplete(prev) ||
          !vaultStacksValid(withCenters(items, prev), viewportW);

        if (needsPlacement) {
          const placed = placeAllStacks(items);
          if (!placed) return prev;
          commitStacks(stackPositionsRef, placed);
          return { ...prev, ...placed };
        }

        let changed = false;
        const next = { ...prev };
        for (const id of STACK_IDS) {
          const current = prev[id]!;
          const { w, h } = stackBounds(id, viewportW);
          const reclamped = reclampVaultCenter(current[0], current[1], w, h);
          if (reclamped[0] !== current[0] || reclamped[1] !== current[1]) {
            next[id] = reclamped;
            stackPositionsRef.current[id] = reclamped;
            changed = true;
          }
        }

        if (
          changed &&
          stacksComplete(next) &&
          !vaultStacksValid(withCenters(items, next), viewportW)
        ) {
          const placed = placeAllStacks(items);
          if (!placed) return next;
          commitStacks(stackPositionsRef, placed);
          return { ...prev, ...placed };
        }

        return changed ? next : prev;
      });
    };

    sync();
    window.addEventListener("resize", sync);
    return () => {
      for (const off of unregister) off();
      window.removeEventListener("resize", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stack, setStack] = useState(INITIAL_STACK);
  const seqRef = useRef(STACK_IDS.length + 1);

  const onInteractionStart = useCallback((id: string) => {
    const n = seqRef.current++;
    setStack((s) => ({ ...s, [id]: n }));
  }, []);

  const zFor = useCallback(
    (stackId: (typeof STACK_IDS)[number]) => {
      const sorted = [...STACK_IDS].sort(
        (a, b) => (stack[a] ?? 0) - (stack[b] ?? 0),
      );
      return VAULT_ARTIFACT_Z_BASE + sorted.indexOf(stackId);
    },
    [stack],
  );

  const pileScale = vaultCollapsedScale(viewport.w);
  const pictureItems = PICTURE_ITEMS.map((item) => ({
    ...item,
    maxWidth: item.maxWidth != null ? item.maxWidth * pileScale : undefined,
    maxHeight: item.maxHeight != null ? item.maxHeight * pileScale : undefined,
  }));

  if (!stacksComplete(stackPositions)) {
    return null;
  }

  const [pictureLeft, pictureTop] = stackPositions["stack-pictures"];
  const [bookLeft, bookTop] = stackPositions["stack-books"];
  const [cartridgeLeft, cartridgeTop] = stackPositions["stack-cartridges"];
  const { w: bookW, h: bookH } = vaultBookBounds(viewport.w);
  const { w: cartridgeW, h: cartridgeH } = vaultCartridgeBounds(viewport.w);

  return (
    <>
      <VaultPictureStack
        id="stack-pictures"
        zIndex={zFor("stack-pictures")}
        onInteractionStart={onInteractionStart}
        items={pictureItems}
        initialLeft={pictureLeft}
        initialTop={pictureTop}
        maxWidth={PICTURE_FOOTPRINT.maxWidth * pileScale}
        maxHeight={PICTURE_FOOTPRINT.maxHeight * pileScale}
      />
      <VaultBook
        id="stack-books"
        zIndex={zFor("stack-books")}
        onInteractionStart={onInteractionStart}
        initialLeft={bookLeft}
        initialTop={bookTop}
        footprintW={bookW}
        footprintH={bookH}
        closedScale={vaultBookClosedScale(viewport.w)}
        openScale={vaultBookOpenScale(viewport.w, viewport.h)}
      />
      <VaultCartridgeStack
        id="stack-cartridges"
        zIndex={zFor("stack-cartridges")}
        onInteractionStart={onInteractionStart}
        initialLeft={cartridgeLeft}
        initialTop={cartridgeTop}
        footprintW={cartridgeW}
        footprintH={cartridgeH}
      />
    </>
  );
}
