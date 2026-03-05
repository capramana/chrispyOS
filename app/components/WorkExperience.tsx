"use client";

import { useState } from "react";

export default function WorkExperience() {
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  const isRevealed = hoveredEntry !== null;

  const titleColor = (entry: string) =>
    hoveredEntry === entry ? "var(--color-primary)" : "var(--color-hushed)";

  const dateColor = (entry: string) =>
    hoveredEntry === entry ? "var(--color-secondary)" : "var(--color-hushed)";

  const rampLogoColor =
    isRevealed && hoveredEntry !== "ramp"
      ? "var(--color-hushed)"
      : "var(--color-primary)";

  return (
    <div
      className="flex flex-col items-end"
      onMouseLeave={() => setHoveredEntry(null)}
    >
      {/* Ramp */}
      <a
        href="https://ramp.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 pb-4"
      >
        <div
          className="text-right transition-opacity duration-200"
          style={{
            opacity: isRevealed ? 1 : 0,
            pointerEvents: isRevealed ? "auto" : "none",
          }}
          onMouseEnter={() => setHoveredEntry("ramp")}
        >
          <div className="font-mono text-sm" style={{ color: titleColor("ramp") }}>
            Ramp
          </div>
          <div className="font-mono text-xs" style={{ color: dateColor("ramp") }}>
            May 2025 - Present
          </div>
        </div>
        <svg
          width="32"
          height="32"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: rampLogoColor, flexShrink: 0 }}
          onMouseEnter={() => setHoveredEntry("ramp")}
        >
          <g clipPath="url(#clip0_886_16)">
            <path
              d="M43 39.822V40H20.0964V39.822C23.4201 37.9831 25.6561 36.1441 27.7108 34.1864H37.1381L43 39.822ZM37.3799 10.5763L31.5784 5H31.3971C31.3971 5 31.518 15.3814 21.7281 24.8729C12.1799 34.1271 1 34.1864 1 34.1864V34.3644L6.9223 40C6.9223 40 17.9813 40.1186 27.7108 30.6864C37.4403 21.3729 37.3799 10.5763 37.3799 10.5763Z"
              fill="currentColor"
            />
          </g>
          <defs>
            <clipPath id="clip0_886_16">
              <rect width="42" height="35" fill="white" transform="translate(1 5)" />
            </clipPath>
          </defs>
        </svg>
      </a>

      {/* Ghost */}
      <a
        href="https://ghst.io/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 transition-all duration-200 ease-out"
        style={{
          opacity: isRevealed ? 1 : 0,
          transform: isRevealed ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: isRevealed ? "auto" : "none",
        }}
        onMouseEnter={() => setHoveredEntry("ghost")}
      >
        <div className="text-right">
          <div className="font-mono text-sm" style={{ color: titleColor("ghost") }}>
            Ghost
          </div>
          <div className="font-mono text-xs" style={{ color: dateColor("ghost") }}>
            Aug 2024 - Apr 2025
          </div>
        </div>
        <svg
          width="32"
          height="32"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            color: hoveredEntry === "ghost" ? "var(--color-primary)" : "var(--color-hushed)",
            flexShrink: 0,
          }}
        >
          <path
            d="M28.8209 33.9443L26.0518 39.916C24.4486 43.3647 19.548 43.3647 17.9448 39.916L15.1756 33.9443C12.4065 27.9545 6.55848 24.0338 0 23.6526C0.838028 35.0334 10.3661 44 21.9891 44C33.6122 44 43.1402 35.0334 43.9783 23.6526C37.438 24.0338 31.5718 27.9726 28.8026 33.9443H28.8209Z"
            fill="currentColor"
          />
          <path
            d="M15.1791 10.0557L17.9483 4.084C19.5515 0.635288 24.4521 0.635288 26.0553 4.084L28.8244 10.0557C31.5935 16.0456 37.4415 19.9662 44 20.3474C43.162 8.96663 33.6339 0 22.0109 0C10.3878 0 0.859756 8.96663 0.0217285 20.3474C6.56199 19.9662 12.4282 16.0274 15.1973 10.0557H15.1791Z"
            fill="currentColor"
          />
        </svg>
      </a>
    </div>
  );
}
