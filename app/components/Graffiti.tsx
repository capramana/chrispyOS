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

function findPlacement(
  W: number,
  H: number,
  placedBoxes: PlacedBox[]
): { top: number; left: number; rotation: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const elementChecks = [
    { selector: "#main-heading",           buffer: 28 },
    { selector: "#main-description",       buffer: 28 },
    { selector: ".navbar-pill",            buffer: 20 },
    { selector: ".transition-blur-corner", buffer: 20 },
    { selector: ".transition-blur-logo",   buffer: 20 },
  ];

  for (let attempt = 0; attempt < 150; attempt++) {
    const left = ROT_PAD_H + Math.random() * (vw - W - ROT_PAD_H * 2);
    const top  = ROT_PAD_V + Math.random() * (vh - H - ROT_PAD_V * 2);

    const gb: PlacedBox = {
      top:    top    - ROT_PAD_V,
      bottom: top    + H + ROT_PAD_V,
      left:   left   - ROT_PAD_H,
      right:  left   + W + ROT_PAD_H,
    };

    let valid = true;

    // Check named UI elements
    for (const { selector, buffer } of elementChecks) {
      for (const el of document.querySelectorAll(selector)) {
        if (overlaps(gb, el.getBoundingClientRect(), buffer)) { valid = false; break; }
      }
      if (!valid) break;
    }

    // Check non-graffiti SVGs (12px buffer)
    if (valid) {
      for (const svg of document.querySelectorAll("svg:not([data-graffiti])")) {
        const r = svg.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (overlaps(gb, r, 12)) { valid = false; break; }
      }
    }

    // Check already-placed graffiti (16px buffer)
    if (valid) {
      for (const box of placedBoxes) {
        if (overlaps(gb, box, 16)) { valid = false; break; }
      }
    }

    if (valid) return { top, left, rotation: (Math.random() - 0.5) * 45 };
  }

  // Fallback: unconstrained, skip other checks
  return {
    top:  ROT_PAD_V + Math.random() * (vh - H - ROT_PAD_V * 2),
    left: ROT_PAD_H + Math.random() * (vw - W - ROT_PAD_H * 2),
    rotation: (Math.random() - 0.5) * 45,
  };
}

function pickAllPlacements(): { variantIdx: number; top: number; left: number; rotation: number; color: string }[] {
  const colors = [...NEON_COLORS].sort(() => Math.random() - 0.5);
  const placedBoxes: PlacedBox[] = [];

  return SVG_VARIANTS.map((variant, idx) => {
    const { top, left, rotation } = findPlacement(variant.w, variant.h, placedBoxes);
    placedBoxes.push({
      top:    top    - ROT_PAD_V,
      bottom: top    + variant.h + ROT_PAD_V,
      left:   left   - ROT_PAD_H,
      right:  left   + variant.w + ROT_PAD_H,
    });
    return { variantIdx: idx, top, left, rotation, color: colors[idx] };
  });
}

export default function Graffiti() {
  const [placements, setPlacements] = useState<{ variantIdx: number; top: number; left: number; rotation: number; color: string }[] | null>(null);
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

    startTimer();
    document.addEventListener("click", handleClick);

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
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
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
