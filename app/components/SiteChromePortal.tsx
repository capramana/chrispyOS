"use client";

import { createPortal } from "react-dom";
import { useClientMounted } from "./useClientMounted";

export default function SiteChromePortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useClientMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}
