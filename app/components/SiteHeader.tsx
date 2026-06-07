"use client";

import {
  cornerArtifactShadowClass,
  useCornerArtifactShadow,
} from "./cornerArtifactShadow";
import SiteChromePortal from "./SiteChromePortal";
import WorkExperience from "./WorkExperience";
import { VAULT_NAV_Z_INDEX } from "./vaultRects";

export default function SiteHeader() {
  const { ref: locationRef, shadowed: locationShadowed } =
    useCornerArtifactShadow<HTMLSpanElement>();
  const { ref: experienceRef, shadowed: experienceShadowed } =
    useCornerArtifactShadow<HTMLDivElement>();
  const locationShadowClass = cornerArtifactShadowClass(
    locationShadowed,
    "text",
  );
  const experienceShadowClass = cornerArtifactShadowClass(
    experienceShadowed,
    "logo",
  );

  return (
    <SiteChromePortal>
      <div
        className="fixed inset-x-6 top-6 flex min-w-0 gap-x-4 overflow-hidden md:inset-x-12 md:top-12"
        data-site-header
        style={{ zIndex: VAULT_NAV_Z_INDEX }}
      >
        <span className="h-8 min-w-0 flex-1 basis-0 overflow-hidden">
          <span
            ref={locationRef}
            className={`block truncate font-mono text-base leading-8 tracking-wide text-primary transition-blur-corner${locationShadowClass ? ` ${locationShadowClass}` : ""}`}
          >
            new york, ny
          </span>
        </span>
        <div
          ref={experienceRef}
          className={`min-w-0 max-w-[min(420px,55%)] shrink transition-blur-logo${experienceShadowClass ? ` ${experienceShadowClass}` : ""}`}
        >
          <WorkExperience />
        </div>
      </div>
    </SiteChromePortal>
  );
}
