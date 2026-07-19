"use client";

import { useState, useRef, useEffect } from "react";
import {
  boxesOverlapBuffered,
  GRAFFITI_SPAWN_CHECKS,
  fitsSpawnUi,
  type PlacementBox,
} from "./uiPlacement";
import { useIsDark } from "./useIsDark";

const IDLE_DELAY = 30000;
const ROT_PAD_V = 16;
const ROT_PAD_H = 16;

const VARIANTS: {
  w: number;
  h: number;
  srcLight: string;
  srcDark: string;
  cursor?: { label: string; href: string };
}[] = [
  {
    w: 151,
    h: 74,
    srcLight: "/graffiti/josephine.png",
    srcDark: "/graffiti/josephine-dark.png",
    cursor: { label: "Josephine", href: "https://www.josephines.world/" },
  },
  {
    w: 83,
    h: 109,
    srcLight: "/graffiti/celine.png",
    srcDark: "/graffiti/celine-dark.png",
    cursor: { label: "Celine", href: "https://celinekeomany.me/" },
  },
  {
    w: 105,
    h: 87,
    srcLight: "/graffiti/flora.png",
    srcDark: "/graffiti/flora-dark.png",
    cursor: { label: "Flora", href: "https://floguo.com" },
  },
];

type Bounds = { minLeft: number; maxLeft: number; minTop: number; maxTop: number };
type Placement = { variantIdx: number; top: number; left: number; rotation: number; quadrant: number };

function paddedBox(top: number, left: number, w: number, h: number): PlacementBox {
  return {
    top: top - ROT_PAD_V,
    bottom: top + h + ROT_PAD_V,
    left: left - ROT_PAD_H,
    right: left + w + ROT_PAD_H,
  };
}

function hitsSvg(gb: PlacementBox) {
  for (const svg of document.querySelectorAll("svg")) {
    const r = svg.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (boxesOverlapBuffered(gb, r, 12)) return true;
  }
  return false;
}

function hitsPlaced(gb: PlacementBox, placed: PlacementBox[]) {
  for (const box of placed) {
    if (boxesOverlapBuffered(gb, box, 16)) return true;
  }
  return false;
}

function findPlacement(
  W: number,
  H: number,
  placedBoxes: PlacementBox[],
  bounds?: Bounds
): { top: number; left: number; rotation: number } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const minLeft = bounds?.minLeft ?? ROT_PAD_H;
  const maxLeft = bounds?.maxLeft ?? (vw - W - ROT_PAD_H);
  const minTop  = bounds?.minTop  ?? ROT_PAD_V;
  const maxTop  = bounds?.maxTop  ?? (vh - H - ROT_PAD_V);

  if (maxLeft < minLeft || maxTop < minTop) return null;

  for (let attempt = 0; attempt < 150; attempt++) {
    const left = minLeft + Math.random() * (maxLeft - minLeft);
    const top  = minTop  + Math.random() * (maxTop  - minTop);
    const gb = paddedBox(top, left, W, H);

    if (!fitsSpawnUi(gb, GRAFFITI_SPAWN_CHECKS)) continue;
    if (hitsSvg(gb) || hitsPlaced(gb, placedBoxes)) continue;

    return { top, left, rotation: (Math.random() - 0.5) * 45 };
  }

  return null;
}

function getQuadrantBounds(quadrant: number, W: number, H: number): Bounds {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hw = vw / 2;
  const hh = vh / 2;

  const qLeft   = quadrant === 1 || quadrant === 3 ? hw : 0;
  const qRight  = quadrant === 1 || quadrant === 3 ? vw : hw;
  const qTop    = quadrant === 2 || quadrant === 3 ? hh : 0;
  const qBottom = quadrant === 2 || quadrant === 3 ? vh : hh;

  return {
    minLeft: qLeft   + ROT_PAD_H,
    maxLeft: qRight  - W - ROT_PAD_H,
    minTop:  qTop    + ROT_PAD_V,
    maxTop:  qBottom - H - ROT_PAD_V,
  };
}

function pickAllPlacements(): Placement[] {
  const variantOrder = VARIANTS.map((_, i) => i).sort(() => Math.random() - 0.5);
  const quadrantOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

  const placedBoxes: PlacementBox[] = [];
  const results: Placement[] = [];

  variantOrder.forEach((variantIdx, i) => {
    const variant = VARIANTS[variantIdx];
    const quadrant = quadrantOrder[i % 4];
    const placement = findPlacement(
      variant.w,
      variant.h,
      placedBoxes,
      getQuadrantBounds(quadrant, variant.w, variant.h),
    );
    if (!placement) return;

    const { top, left, rotation } = placement;
    placedBoxes.push(paddedBox(top, left, variant.w, variant.h));
    results.push({ variantIdx, top, left, rotation, quadrant });
  });

  return results;
}

export default function Graffiti() {
  const isDark = useIsDark();
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPlacements(pickAllPlacements());
      visibleRef.current = true;
      setVisible(true);
    }, IDLE_DELAY);
  };

  useEffect(() => {
    let alive = true;

    const handleClick = () => {
      if (visibleRef.current) return;
      startTimer();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (!visibleRef.current) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!alive) return;
        setPlacements((prev) => {
          if (!prev) return prev;

          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const kept: Placement[] = [];
          const toFix: Placement[] = [];

          for (const p of prev) {
            const { w, h } = VARIANTS[p.variantIdx];
            const offScreen =
              p.left < ROT_PAD_H ||
              p.left + w > vw - ROT_PAD_H ||
              p.top < ROT_PAD_V ||
              p.top + h > vh - ROT_PAD_V;

            if (offScreen) {
              toFix.push(p);
              continue;
            }

            const gb = paddedBox(p.top, p.left, w, h);
            const bad = !fitsSpawnUi(gb, GRAFFITI_SPAWN_CHECKS) || hitsSvg(gb);
            (bad ? toFix : kept).push(p);
          }

          if (toFix.length === 0) return prev;

          const placedBoxes = kept.map((p) => {
            const { w, h } = VARIANTS[p.variantIdx];
            return paddedBox(p.top, p.left, w, h);
          });

          const result: Placement[] = [...kept];
          for (const p of toFix) {
            const { w, h } = VARIANTS[p.variantIdx];
            const placement = findPlacement(
              w,
              h,
              placedBoxes,
              getQuadrantBounds(p.quadrant, w, h),
            );
            if (!placement) continue;
            result.push({ ...p, top: placement.top, left: placement.left });
            placedBoxes.push(paddedBox(placement.top, placement.left, w, h));
          }

          return result;
        });
      }, 150);
    };

    startTimer();
    document.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);

    return () => {
      alive = false;
      document.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  if (!placements) return null;

  return (
    <>
      {placements.map(({ variantIdx, top, left, rotation }) => {
        const { w, h, srcLight, srcDark, cursor } = VARIANTS[variantIdx];
        const interactive = Boolean(cursor) && visible;
        const img = (
          <img
            src={isDark ? srcDark : srcLight}
            alt=""
            width={w}
            height={h}
            draggable={false}
            className="block size-full"
          />
        );

        return (
          <div
            key={variantIdx}
            style={{
              position: "fixed",
              top,
              left,
              width: w,
              height: h,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
              pointerEvents: interactive ? "auto" : "none",
              zIndex: 50,
              opacity: visible ? 1 : 0,
              filter: visible ? "none" : "blur(8px)",
              transition: "opacity 0.5s ease, filter 0.5s ease",
            }}
          >
            {cursor ? (
              <a
                href={cursor.href}
                target="_blank"
                rel="noopener noreferrer"
                data-site-cursor=""
                data-site-cursor-label={cursor.label}
                data-site-cursor-href={cursor.href}
                aria-label={cursor.label}
                className="block size-full"
                tabIndex={interactive ? 0 : -1}
              >
                {img}
              </a>
            ) : (
              img
            )}
          </div>
        );
      })}
    </>
  );
}
