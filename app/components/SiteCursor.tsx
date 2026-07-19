"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClientMounted } from "./useClientMounted";
import "./SiteCursor.css";

type CursorTarget = {
  label: string;
  href: string;
};

type CursorMode = "default" | "text" | "pressed" | "expanded" | "grab";

type CursorUi = {
  visible: boolean;
  target: CursorTarget | null;
  text: boolean;
  grab: boolean;
  pressed: boolean;
  nativeOverride: boolean;
};

const INITIAL_UI: CursorUi = {
  visible: false,
  target: null,
  text: false,
  grab: false,
  pressed: false,
  nativeOverride: false,
};

function readTarget(el: Element | null): CursorTarget | null {
  const node = el?.closest?.("[data-site-cursor]") as HTMLElement | null;
  if (!node) return null;
  const label = node.dataset.siteCursorLabel?.trim();
  const href = node.dataset.siteCursorHref?.trim();
  if (!label || !href) return null;
  return { label, href };
}

function sameTarget(a: CursorTarget | null, b: CursorTarget | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.label === b.label && a.href === b.href;
}

function prefersFinePointer() {
  return window.matchMedia("(pointer: fine)").matches;
}

function inlineCursor(el: Element | null): string | null {
  let n: HTMLElement | null =
    el instanceof HTMLElement ? el : (el?.parentElement ?? null);
  while (n) {
    const c = n.style.cursor;
    if (c) return c;
    if (n.classList.contains("cursor-grab")) return "grab";
    if (n.classList.contains("cursor-grabbing")) return "grabbing";
    n = n.parentElement;
  }
  return null;
}

function isGrabTarget(el: Element | null) {
  const c = inlineCursor(el);
  return c === "grab" || c === "grabbing";
}

function isNativeOverride(el: Element | null) {
  const c = inlineCursor(el) ?? (el ? getComputedStyle(el).cursor : "");
  return (
    c === "ew-resize" ||
    c === "ns-resize" ||
    c === "col-resize" ||
    c === "row-resize" ||
    c === "crosshair"
  );
}

function mergeLineBands(rects: DOMRect[]) {
  const lines: { top: number; bottom: number; left: number; right: number }[] = [];
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const midY = (rect.top + rect.bottom) / 2;
    const line = lines.find((l) => midY >= l.top && midY <= l.bottom);
    if (!line) {
      lines.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
      continue;
    }
    line.left = Math.min(line.left, rect.left);
    line.right = Math.max(line.right, rect.right);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
  }
  return lines;
}

function pointInLineBands(
  x: number,
  y: number,
  lines: { top: number; bottom: number; left: number; right: number }[],
  pad = 2,
) {
  return lines.some(
    (line) =>
      x >= line.left - pad &&
      x <= line.right + pad &&
      y >= line.top - pad &&
      y <= line.bottom + pad,
  );
}

function textHostLineBands(host: Element) {
  const range = document.createRange();
  range.selectNodeContents(host);
  let rects = Array.from(range.getClientRects());
  if (rects.length === 0) {
    rects = [host.getBoundingClientRect()];
  }
  return mergeLineBands(rects);
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "file",
  "color",
  "range",
]);

function isSelectableTextAt(x: number, y: number, el: Element | null) {
  if (!el) return false;
  if (el.closest("[data-site-cursor], a, button, [role='button']")) return false;
  if (el.closest(".select-none")) return false;
  if (isGrabTarget(el)) return false;

  const field = el.closest(
    "input, textarea, [contenteditable='true'], [contenteditable='']",
  ) as HTMLElement | null;
  if (field) {
    if (field instanceof HTMLInputElement && NON_TEXT_INPUT_TYPES.has(field.type)) {
      return false;
    }
    return getComputedStyle(field).userSelect !== "none";
  }

  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const caret = doc.caretRangeFromPoint?.(x, y);
  let host: Element | null = null;

  if (caret?.startContainer.nodeType === Node.TEXT_NODE && caret.startContainer.textContent?.trim()) {
    host = caret.startContainer.parentElement;
  } else {
    host = el.closest("p, h1, h2, h3, h4, h5, h6, li, label, span, td, th, blockquote, pre");
  }

  if (!host) return false;
  if (host.closest("[data-site-cursor], a, button, [role='button'], .select-none")) {
    return false;
  }
  if (getComputedStyle(host).userSelect === "none") return false;
  if (!host.textContent?.trim()) return false;

  return pointInLineBands(x, y, textHostLineBands(host));
}

function modeFor(ui: CursorUi): CursorMode {
  const expanded = Boolean(ui.target) && !ui.nativeOverride && !ui.grab;
  if (expanded) return "expanded";
  if (ui.grab) return "grab";
  if (ui.text) return "text";
  if (ui.pressed) return "pressed";
  return "default";
}

export default function SiteCursor() {
  const mounted = useClientMounted();
  const [enabled, setEnabled] = useState(false);
  const [ui, setUi] = useState<CursorUi>(INITIAL_UI);
  const posRef = useRef({ x: 0, y: 0 });
  const elRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const uiRef = useRef(INITIAL_UI);

  useEffect(() => {
    if (!mounted) return;

    const syncEnabled = () => setEnabled(prefersFinePointer());
    syncEnabled();

    const mq = window.matchMedia("(pointer: fine)");
    mq.addEventListener("change", syncEnabled);
    return () => mq.removeEventListener("change", syncEnabled);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !enabled) return;

    document.documentElement.classList.add("site-cursor-on");

    const paint = () => {
      rafRef.current = 0;
      const el = elRef.current;
      if (!el) return;
      const { x, y } = posRef.current;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const schedulePaint = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(paint);
    };

    const patchUi = (patch: Partial<CursorUi>) => {
      const prev = uiRef.current;
      const next = { ...prev, ...patch };
      if (
        next.visible === prev.visible &&
        sameTarget(next.target, prev.target) &&
        next.text === prev.text &&
        next.grab === prev.grab &&
        next.pressed === prev.pressed &&
        next.nativeOverride === prev.nativeOverride
      ) {
        return;
      }
      uiRef.current = next;
      setUi(next);
    };

    const syncFromPoint = (x: number, y: number, pressed: boolean) => {
      const under = document.elementFromPoint(x, y);
      patchUi({
        visible: true,
        target: readTarget(under),
        grab: isGrabTarget(under),
        nativeOverride: isNativeOverride(under),
        text: isSelectableTextAt(x, y, under),
        pressed,
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      schedulePaint();
      syncFromPoint(e.clientX, e.clientY, e.buttons === 1);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      patchUi({ pressed: true });
    };

    const onPointerUp = () => patchUi({ pressed: false });

    const onPointerLeave = () => {
      patchUi({ visible: false, pressed: false });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);

    return () => {
      document.documentElement.classList.remove("site-cursor-on");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, enabled]);

  if (!mounted || !enabled) return null;

  const mode = modeFor(ui);
  const show = ui.visible && !ui.nativeOverride;

  return createPortal(
    <div
      ref={elRef}
      className={`site-cursor site-cursor--${mode}${show ? " site-cursor--visible" : ""}`}
      aria-hidden
    >
      <div className="site-cursor__shell">
        <span className="site-cursor__label">{ui.target?.label ?? ""}</span>
        <svg
          className="site-cursor__arrow"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 9.5L9.5 3M9.5 3V9.24M9.5 3H3.26"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>,
    document.body,
  );
}
