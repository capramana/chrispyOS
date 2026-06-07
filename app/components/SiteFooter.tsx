"use client";

import Clock from "./Clock";
import {
  cornerArtifactShadowClass,
  useCornerArtifactShadow,
} from "./cornerArtifactShadow";
import SiteChromePortal from "./SiteChromePortal";
import { VAULT_NAV_Z_INDEX } from "./vaultRects";

const FOOTER_CORNER_SHELL =
  "fixed bottom-12 hidden h-[var(--navbar-pill-height)] items-center md:flex";

function SiteFooterCorner({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${FOOTER_CORNER_SHELL} ${side === "left" ? "left-12" : "right-12"}`}
      data-site-footer-corner
      style={{ zIndex: VAULT_NAV_Z_INDEX }}
    >
      {children}
    </div>
  );
}

export default function SiteFooter() {
  const { ref: clockRef, shadowed: clockShadowed } =
    useCornerArtifactShadow<HTMLDivElement>();
  const { ref: handleRef, shadowed: handleShadowed } =
    useCornerArtifactShadow<HTMLAnchorElement>();
  const clockShadowClass = cornerArtifactShadowClass(clockShadowed, "text");
  const handleShadowClass = cornerArtifactShadowClass(handleShadowed, "text");

  return (
    <SiteChromePortal>
      <SiteFooterCorner side="left">
        <div ref={clockRef} className="transition-blur-corner">
          <Clock className={clockShadowClass || undefined} />
        </div>
      </SiteFooterCorner>

      <SiteFooterCorner side="right">
        <a
          ref={handleRef}
          href="https://x.com/chrispramana"
          target="_blank"
          rel="noopener noreferrer"
          className={`transition-blur-corner block font-mono text-base tracking-wide text-primary hover:underline${handleShadowClass ? ` ${handleShadowClass}` : ""}`}
        >
          @chrispramana
        </a>
      </SiteFooterCorner>
    </SiteChromePortal>
  );
}
