"use client";

import { useEffect, useRef, useState } from "react";
import { overlaps } from "./placement";

type ShadowTarget = {
  el: HTMLElement;
  onChange: (shadowed: boolean) => void;
  shadowed: boolean;
};

const targets = new Set<ShadowTarget>();
let rafId: number | null = null;
let idlePollId: number | null = null;
let visibilityBound = false;

const TEXT_SHADOW_CLASS = "site-corner-artifact-shadow-text";
const LOGO_SHADOW_CLASS = "site-corner-artifact-shadow-logo";

function isVisibleArtifact(el: HTMLElement) {
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (parseFloat(style.opacity) < 0.05) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function artifactRects() {
  return Array.from(document.querySelectorAll<HTMLElement>(".vault-artifact"))
    .filter(isVisibleArtifact)
    .map((el) => el.getBoundingClientRect());
}

function domRectsOverlap(a: DOMRect, b: DOMRect) {
  return overlaps(
    { left: a.left, top: a.top, right: a.right, bottom: a.bottom },
    { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
  );
}

function clearAllShadows() {
  for (const target of targets) {
    if (target.shadowed) {
      target.shadowed = false;
      target.onChange(false);
    }
  }
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (idlePollId !== null) {
    window.clearTimeout(idlePollId);
    idlePollId = null;
  }
}

function tickActive() {
  rafId = null;

  if (targets.size === 0 || document.hidden) {
    clearAllShadows();
    return;
  }

  const artifacts = artifactRects();
  if (artifacts.length === 0) {
    clearAllShadows();
    scheduleLoop();
    return;
  }

  for (const target of targets) {
    const corner = target.el.getBoundingClientRect();
    const hit = artifacts.some((artifact) => domRectsOverlap(corner, artifact));
    if (hit !== target.shadowed) {
      target.shadowed = hit;
      target.onChange(hit);
    }
  }

  rafId = requestAnimationFrame(tickActive);
}

function scheduleLoop() {
  if (targets.size === 0 || document.hidden) return;

  if (artifactRects().length > 0) {
    if (rafId === null) rafId = requestAnimationFrame(tickActive);
    return;
  }

  if (idlePollId === null) {
    idlePollId = window.setTimeout(() => {
      idlePollId = null;
      scheduleLoop();
    }, 200);
  }
}

function ensureVisibilityListener() {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
      clearAllShadows();
    } else {
      scheduleLoop();
    }
  });
}

function registerCornerShadowTarget(
  el: HTMLElement,
  onChange: (shadowed: boolean) => void,
) {
  const target: ShadowTarget = { el, onChange, shadowed: false };
  targets.add(target);
  ensureVisibilityListener();
  scheduleLoop();
  return () => {
    targets.delete(target);
    onChange(false);
    if (targets.size === 0) {
      stopLoop();
    } else {
      scheduleLoop();
    }
  };
}

export function cornerArtifactShadowClass(
  shadowed: boolean,
  kind: "text" | "logo",
) {
  if (!shadowed) return "";
  return kind === "text" ? TEXT_SHADOW_CLASS : LOGO_SHADOW_CLASS;
}

export function useCornerArtifactShadow<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const [shadowed, setShadowed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerCornerShadowTarget(el, setShadowed);
  }, []);

  return { ref, shadowed };
}
