"use client";

import { createPortal } from "react-dom";
import { useClientMounted } from "./useClientMounted";
import WorkExperience from "./WorkExperience";
import { VAULT_NAV_Z_INDEX } from "./vaultRects";

export default function SiteHeader() {
  const mounted = useClientMounted();

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-x-12 top-12 flex min-w-0 gap-x-4 overflow-hidden"
      data-site-header
      style={{ zIndex: VAULT_NAV_Z_INDEX }}
    >
      <span className="h-8 min-w-0 flex-1 basis-0 overflow-hidden">
        <span className="block truncate font-mono text-base leading-8 tracking-wide text-primary">
          new york, ny
        </span>
      </span>
      <div className="min-w-0 max-w-[min(420px,55%)] shrink">
        <WorkExperience />
      </div>
    </div>,
    document.body,
  );
}
