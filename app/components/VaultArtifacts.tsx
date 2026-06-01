"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import VaultPictureStack, { type VaultPictureItem } from "./VaultPictureStack";
import VaultBook from "./VaultBook";
import VaultCartridgeStack from "./VaultCartridgeStack";
import {
  pickRandomVaultCenter,
  reclampVaultCenter,
  VAULT_ARTIFACT_Z_BASE,
  vaultBookBounds,
  vaultCartridgeBounds,
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

function stackBounds(stackId: (typeof STACK_IDS)[number]) {
  if (stackId === "stack-pictures") {
    return vaultStackBounds(PICTURE_FOOTPRINT.maxWidth, PICTURE_FOOTPRINT.maxHeight);
  }
  if (stackId === "stack-books") return vaultBookBounds();
  return vaultCartridgeBounds();
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
  const stackPositionsRef = useRef<
    Partial<Record<(typeof STACK_IDS)[number], readonly [number, number]>>
  >({});
  const [stackPositions, setStackPositions] = useState<
    Partial<Record<(typeof STACK_IDS)[number], readonly [number, number]>>
  >({});

  useLayoutEffect(() => {
    const unregister = STACK_IDS.map((stackId) =>
      registerSpawnPeer(STACK_SPAWN_PEER[stackId], () => {
        const p = stackPositionsRef.current[stackId];
        if (!p) return null;
        const { w, h } = stackBounds(stackId);
        return boxFromTopLeft(p[0] - w / 2, p[1] - h / 2, w, h);
      }),
    );

    const sync = () => {
      setStackPositions((prev) => {
        let changed = false;
        const next = { ...prev };

        for (const stackId of STACK_IDS) {
          const { w, h } = stackBounds(stackId);
          const peerId = STACK_SPAWN_PEER[stackId];
          const current = prev[stackId];

          if (!current) {
            const picked = pickRandomVaultCenter(w, h, peerId);
            next[stackId] = picked;
            stackPositionsRef.current[stackId] = picked;
            changed = true;
            continue;
          }

          const reclamped = reclampVaultCenter(current[0], current[1], w, h);
          if (reclamped[0] !== current[0] || reclamped[1] !== current[1]) {
            next[stackId] = reclamped;
            stackPositionsRef.current[stackId] = reclamped;
            changed = true;
          }
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

  if (
    !stackPositions["stack-pictures"] ||
    !stackPositions["stack-books"] ||
    !stackPositions["stack-cartridges"]
  ) {
    return null;
  }

  const [pictureLeft, pictureTop] = stackPositions["stack-pictures"];
  const [bookLeft, bookTop] = stackPositions["stack-books"];
  const [cartridgeLeft, cartridgeTop] = stackPositions["stack-cartridges"];
  const { w: bookW, h: bookH } = vaultBookBounds();
  const { w: cartridgeW, h: cartridgeH } = vaultCartridgeBounds();

  return (
    <>
      <VaultPictureStack
        id="stack-pictures"
        zIndex={zFor("stack-pictures")}
        onInteractionStart={onInteractionStart}
        items={PICTURE_ITEMS}
        initialLeft={pictureLeft}
        initialTop={pictureTop}
        maxWidth={PICTURE_FOOTPRINT.maxWidth}
        maxHeight={PICTURE_FOOTPRINT.maxHeight}
      />
      <VaultBook
        id="stack-books"
        zIndex={zFor("stack-books")}
        onInteractionStart={onInteractionStart}
        initialLeft={bookLeft}
        initialTop={bookTop}
        footprintW={bookW}
        footprintH={bookH}
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
