"use client";

import { useState, useRef, useEffect } from "react";
import JosephinePaths from "./Graffiti art/JosephinePaths";
import CelinePaths from "./Graffiti art/CelinePaths";
import FloraPaths from "./Graffiti art/FloraPaths";

const IDLE_DELAY = 30000;
// Extra padding to account for ±22.5° rotation expanding the visual bounding box
const ROT_PAD_V = 16;
const ROT_PAD_H = 16;

const SVG_VARIANTS: { w: number; h: number; viewBox: string; paths: React.ReactNode }[] = [
  {
    w: 151, h: 75, viewBox: "0 0 151 75",
    paths: <JosephinePaths />,
  },
  {
    w: 84, h: 109, viewBox: "0 0 84 109",
    paths: <CelinePaths />,
  },
  {
    w: 168, h: 152, viewBox: "0 0 168 152",
    paths: <FloraPaths />,
  },
];

const NEON_COLORS = ["#FF6B9D", "#00F5FF", "#7B2FFF", "#FFE600", "#00FF88"];

function overlaps(
  gb: { top: number; bottom: number; left: number; right: number },
  r: { top: number; bottom: number; left: number; right: number },
  buffer: number
) {
  return (
    gb.left   < r.right  + buffer &&
    gb.right  > r.left   - buffer &&
    gb.top    < r.bottom + buffer &&
    gb.bottom > r.top    - buffer
  );
}

type PlacedBox = { top: number; bottom: number; left: number; right: number };
type Bounds    = { minLeft: number; maxLeft: number; minTop: number; maxTop: number };
type Placement = { variantIdx: number; top: number; left: number; rotation: number; color: string; quadrant: number };

function findPlacement(
  W: number,
  H: number,
  placedBoxes: PlacedBox[],
  bounds?: Bounds
): { top: number; left: number; rotation: number } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const minLeft = bounds?.minLeft ?? ROT_PAD_H;
  const maxLeft = bounds?.maxLeft ?? (vw - W - ROT_PAD_H);
  const minTop  = bounds?.minTop  ?? ROT_PAD_V;
  const maxTop  = bounds?.maxTop  ?? (vh - H - ROT_PAD_V);

  // SVG doesn't fit within the given bounds — drop it
  if (maxLeft < minLeft || maxTop < minTop) return null;

  const elementChecks = [
    { selector: "#main-heading",           buffer: 28 },
    { selector: "#main-description",       buffer: 28 },
    { selector: ".navbar-pill",            buffer: 20 },
    { selector: ".transition-blur-corner", buffer: 20 },
    { selector: ".transition-blur-logo",   buffer: 20 },
  ];

  for (let attempt = 0; attempt < 150; attempt++) {
    const left = minLeft + Math.random() * (maxLeft - minLeft);
    const top  = minTop  + Math.random() * (maxTop  - minTop);

    const gb: PlacedBox = {
      top:    top    - ROT_PAD_V,
      bottom: top    + H + ROT_PAD_V,
      left:   left   - ROT_PAD_H,
      right:  left   + W + ROT_PAD_H,
    };

    let valid = true;

    for (const { selector, buffer } of elementChecks) {
      for (const el of document.querySelectorAll(selector)) {
        if (overlaps(gb, el.getBoundingClientRect(), buffer)) { valid = false; break; }
      }
      if (!valid) break;
    }

    if (valid) {
      for (const svg of document.querySelectorAll("svg:not([data-graffiti])")) {
        const r = svg.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (overlaps(gb, r, 12)) { valid = false; break; }
      }
    }

    if (valid) {
      for (const box of placedBoxes) {
        if (overlaps(gb, box, 16)) { valid = false; break; }
      }
    }

    if (valid) return { top, left, rotation: (Math.random() - 0.5) * 45 };
  }

  // 150 attempts exhausted — drop this SVG
  return null;
}

// Quadrant indices: 0=TL, 1=TR, 2=BL, 3=BR
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
  const n = SVG_VARIANTS.length;

  // Distribute variants evenly across 4 quadrants: base per quadrant, extra quadrants get +1
  const base  = Math.floor(n / 4);
  const extra = n % 4;

  // Shuffle quadrant order so the "extra" assignments rotate randomly
  const quadrantOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const quadrantCounts = [0, 0, 0, 0];
  for (let q = 0; q < 4; q++) {
    quadrantCounts[quadrantOrder[q]] = q < extra ? base + 1 : base;
  }

  // Shuffle variant order so quadrant assignment is random each time
  const variantOrder = SVG_VARIANTS.map((_, i) => i).sort(() => Math.random() - 0.5);

  // Assign variant indices to quadrants
  const assignments: number[][] = [[], [], [], []];
  let vi = 0;
  for (let q = 0; q < 4; q++) {
    for (let c = 0; c < quadrantCounts[q]; c++) {
      assignments[q].push(variantOrder[vi++]);
    }
  }

  // Shuffle and cycle colors
  const colorPool = [...NEON_COLORS].sort(() => Math.random() - 0.5);
  const getColor = (i: number) => colorPool[i % colorPool.length];

  const placedBoxes: PlacedBox[] = [];
  const results: Placement[] = [];
  let colorIdx = 0;

  for (let q = 0; q < 4; q++) {
    for (const variantIdx of assignments[q]) {
      const variant  = SVG_VARIANTS[variantIdx];
      const bounds   = getQuadrantBounds(q, variant.w, variant.h);
      const placement = findPlacement(variant.w, variant.h, placedBoxes, bounds);
      if (!placement) { colorIdx++; continue; } // doesn't fit — skip it
      const { top, left, rotation } = placement;
      placedBoxes.push({
        top:    top    - ROT_PAD_V,
        bottom: top    + variant.h + ROT_PAD_V,
        left:   left   - ROT_PAD_H,
        right:  left   + variant.w + ROT_PAD_H,
      });
      results.push({ variantIdx, top, left, rotation, color: getColor(colorIdx++), quadrant: q });
    }
  }

  return results;
}

export default function Graffiti() {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [instant, setInstant] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!document.documentElement.classList.contains("dark")) return;
      setPlacements(pickAllPlacements());
      visibleRef.current = true;
      setVisible(true);
    }, IDLE_DELAY);
  };

  useEffect(() => {
    // Only clicks reset the idle timer — mouse movement is allowed
    const handleClick = () => {
      if (visibleRef.current) return; // already showing, leave it
      startTimer();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (!visibleRef.current) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setPlacements(prev => {
          if (!prev) return prev;

          // Separate compliant placements from those now out of bounds
          const kept: Placement[]  = [];
          const toFix: Placement[] = [];

          for (const p of prev) {
            const variant = SVG_VARIANTS[p.variantIdx];
            const b = getQuadrantBounds(p.quadrant, variant.w, variant.h);
            const valid = b.maxLeft >= b.minLeft && b.maxTop >= b.minTop &&
                          p.left >= b.minLeft && p.left <= b.maxLeft &&
                          p.top  >= b.minTop  && p.top  <= b.maxTop;
            (valid ? kept : toFix).push(p);
          }

          if (toFix.length === 0) return prev; // nothing moved out of bounds

          // Build collision list from already-kept placements
          const placedBoxes: PlacedBox[] = kept.map(p => {
            const v = SVG_VARIANTS[p.variantIdx];
            return { top: p.top - ROT_PAD_V, bottom: p.top + v.h + ROT_PAD_V,
                     left: p.left - ROT_PAD_H, right: p.left + v.w + ROT_PAD_H };
          });

          const result: Placement[] = [...kept];

          for (const p of toFix) {
            const variant   = SVG_VARIANTS[p.variantIdx];
            const bounds    = getQuadrantBounds(p.quadrant, variant.w, variant.h);
            const placement = findPlacement(variant.w, variant.h, placedBoxes, bounds);
            if (placement) {
              result.push({ ...p, top: placement.top, left: placement.left, rotation: placement.rotation });
              placedBoxes.push({
                top:    placement.top  - ROT_PAD_V,
                bottom: placement.top  + variant.h + ROT_PAD_V,
                left:   placement.left - ROT_PAD_H,
                right:  placement.left + variant.w + ROT_PAD_H,
              });
            }
            // else: quadrant too small — SVG is omitted
          }

          return result;
        });
      }, 150);
    };

    startTimer();
    document.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      if (!isDark) {
        visibleRef.current = false;
        setInstant(true);
        setVisible(false);
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        setInstant(false);
        startTimer();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  if (!placements) return null;

  return (
    <>
      {placements.map(({ variantIdx, top, left, rotation, color }) => {
        const { w, h, viewBox, paths } = SVG_VARIANTS[variantIdx];
        const filterId = `graffiti-glow-${variantIdx}`;
        return (
          <div
            key={variantIdx}
            style={{
              position: "fixed",
              top,
              left,
              width: w,
              height: h,
              overflow: "visible",
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
              color,
              pointerEvents: "none",
              zIndex: 50,
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(8px)",
              transition: instant ? "none" : "opacity 0.5s ease, filter 0.5s ease",
            }}
          >
            <svg data-graffiti width={w} height={h} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
              <defs>
                <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="3" result="blur-tight" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur-wide" />
                  <feMerge>
                    <feMergeNode in="blur-wide" />
                    <feMergeNode in="blur-tight" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g filter={`url(#${filterId})`}>
                {paths}
              </g>
            </svg>
          </div>
        );
      })}
    </>
  );
}
