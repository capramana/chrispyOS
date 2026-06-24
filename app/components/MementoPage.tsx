"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MEMENTO_COLORS,
  MEMENTO_HOST_PROFILES,
  type MementoStep,
  type SocialType,
} from "./mementoColors";
import MementoSocialField from "./MementoSocialField";
import { RefreshDouble, Undo } from "iconoir-react";
import {
  applyDevConfirmPreviewState,
  DEV_CONFIRM_PREVIEW,
  isDevConfirmStepSearch,
  type MementoDevConfirmPreview,
} from "@/app/memento/devConfirmPreview";
import "./Memento.css";

const TRANSITION_MS = 150;
const CANVAS_SHRINK_MS = 180;

const PREVIEW_ROTATION_DEG = 2;
const EXPORT_ALPHA_THRESHOLD = 1;
const EXPORT_PADDING_CSS_PX = 4;
const MAX_UNDO = 40;
const PHONE_LANDSCAPE_MQ = "(orientation: landscape) and (max-height: 500px)";
const PHONE_PORTRAIT_MQ = "(max-width: 768px) and (orientation: portrait)";

function isPhoneLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(PHONE_LANDSCAPE_MQ).matches;
}

function isPhonePortraitViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(PHONE_PORTRAIT_MQ).matches;
}

function canvasLogicalSize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  return {
    width: canvas.width > 0 ? canvas.width / dpr : 0,
    height: canvas.height > 0 ? canvas.height / dpr : 0,
  };
}

function replayStepAnimation(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("step-anim");
  void element.offsetWidth;
  element.classList.add("step-anim");
}

function exportCroppedTransparentPng(canvas: HTMLCanvasElement): {
  dataUrl: string;
  width: number;
  height: number;
} | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const { width, height } = canvas;
  const rect = canvas.getBoundingClientRect();
  if (width === 0 || height === 0 || rect.width === 0) return null;

  const dpr = width / rect.width;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > EXPORT_ALPHA_THRESHOLD) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return null;

  const pad = Math.ceil(EXPORT_PADDING_CSS_PX * dpr);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;

  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return {
    dataUrl: out.toDataURL("image/png"),
    width: cropW / dpr,
    height: cropH / dpr,
  };
}

function rotatedPreviewBounds(width: number, height: number, scale = 1) {
  const w = width * scale;
  const h = height * scale;
  const rad = (PREVIEW_ROTATION_DEG * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
}

function fitPreviewSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight, scale: 1 };
  }
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

type PreviewScale = {
  previewWidth: number;
  previewHeight: number;
  previewScale: number;
};

function computeFormPreviewFit(
  wrapWidth: number,
  wrapHeight: number,
  slotWidth: number,
  slotHeight: number,
): PreviewScale | null {
  if (wrapWidth <= 0 || wrapHeight <= 0 || slotWidth <= 0 || slotHeight <= 0) {
    return null;
  }

  const unit = rotatedPreviewBounds(wrapWidth, wrapHeight, 1);
  const scale = Math.min(slotWidth / unit.width, slotHeight / unit.height);
  const scaled = rotatedPreviewBounds(wrapWidth, wrapHeight, scale);

  return {
    previewWidth: Math.ceil(scaled.width),
    previewHeight: Math.ceil(scaled.height),
    previewScale: scale,
  };
}

type FrozenCanvasLayout = PreviewScale & {
  width: number;
  height: number;
  previewWrapWidth: number;
  previewWrapHeight: number;
};

function getPreviewDisplay(
  layoutVars: FrozenCanvasLayout | null,
  isFormStep: boolean,
  formPreview: PreviewScale | null,
): PreviewScale | null {
  if (!layoutVars) return null;
  if (isFormStep && formPreview) return formPreview;
  return {
    previewWidth: layoutVars.previewWidth,
    previewHeight: layoutVars.previewHeight,
    previewScale: layoutVars.previewScale,
  };
}

export type { MementoDevConfirmPreview };

type MementoPageProps = {
  devConfirmPreview?: MementoDevConfirmPreview | null;
};

export default function MementoPage({
  devConfirmPreview = null,
}: MementoPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSlotRef = useRef<HTMLDivElement>(null);
  const colorRowRef = useRef<HTMLDivElement>(null);
  const confirmStepRef = useRef<HTMLDivElement>(null);
  const formTransitionRef = useRef<number[]>([]);

  const [step, setStep] = useState<MementoStep>(devConfirmPreview ? 3 : 1);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [currentColor, setCurrentColor] = useState<string>(MEMENTO_COLORS[0].color);
  const [socialType, setSocialType] = useState<SocialType>("twitter");
  const [capturedDrawing, setCapturedDrawing] = useState<string | null>(
    devConfirmPreview?.drawing ?? null,
  );
  const [drawingSize, setDrawingSize] = useState<{
    width: number;
    height: number;
  } | null>(devConfirmPreview?.size ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmName, setConfirmName] = useState(devConfirmPreview?.name ?? "");
  const [confirmSocialType, setConfirmSocialType] = useState<SocialType>(
    devConfirmPreview?.socialType ?? "twitter",
  );
  const [layoutVars, setLayoutVars] = useState<FrozenCanvasLayout | null>(null);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");

  const [errCanvas, setErrCanvas] = useState("");
  const [errName, setErrName] = useState("");
  const [errHandle, setErrHandle] = useState("");
  const [formError, setFormError] = useState("");
  const [formExpanded, setFormExpanded] = useState(false);
  const [formShown, setFormShown] = useState(false);
  const [formPreviewLayout, setFormPreviewLayout] = useState<PreviewScale | null>(
    null,
  );
  const [canUndo, setCanUndo] = useState(false);
  const [colorRowFade, setColorRowFade] = useState(false);
  const [isPhoneLandscape, setIsPhoneLandscape] = useState(false);
  const [portraitCanvasSize, setPortraitCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const stepRef = useRef<MementoStep>(step);
  const editingSnapshotRef = useRef<string | null>(null);
  const drawingSnapshotRef = useRef<string | null>(null);
  const portraitCanvasSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );
  const wasPhoneLandscapeDrawRef = useRef(false);
  const layoutVarsRef = useRef(layoutVars);
  const mountedRef = useRef(true);

  const clearFormTimers = useCallback(() => {
    formTransitionRef.current.forEach((id) => window.clearTimeout(id));
    formTransitionRef.current = [];
  }, []);

  const deferFormStep = useCallback((fn: () => void, ms = TRANSITION_MS) => {
    const id = window.setTimeout(fn, ms);
    formTransitionRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    stepRef.current = step;
    layoutVarsRef.current = layoutVars;
  }, [step, layoutVars]);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_LANDSCAPE_MQ);
    const sync = () => setIsPhoneLandscape(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    portraitCanvasSizeRef.current = null;
    setPortraitCanvasSize(null);
    drawingSnapshotRef.current = null;
  }, [step]);

  useEffect(() => {
    if (step !== 2) {
      clearFormTimers();
      setFormExpanded(false);
      setFormShown(false);
      return;
    }

    clearFormTimers();
    const showId = deferFormStep(() => setFormShown(true), CANVAS_SHRINK_MS);

    return () => {
      window.clearTimeout(showId);
      clearFormTimers();
    };
  }, [step, clearFormTimers, deferFormStep]);

  useEffect(() => () => clearFormTimers(), [clearFormTimers]);

  useEffect(() => {
    if (step !== 1) return;
    const page = document.querySelector(".memento-root .page");
    if (page) page.scrollTop = 0;
  }, [step]);

  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (devConfirmPreview) {
      replayStepAnimation(confirmStepRef.current);
      return;
    }

    if (!isDevConfirmStepSearch(window.location.search)) return;

    applyDevConfirmPreviewState(DEV_CONFIRM_PREVIEW, {
      setStep,
      setConfirmName,
      setConfirmSocialType,
      setCapturedDrawing,
      setDrawingSize,
    });
    replayStepAnimation(confirmStepRef.current);
  }, [devConfirmPreview]);

  const measureFormPreview = useCallback(() => {
    const slot = canvasSlotRef.current;
    const frozen = layoutVarsRef.current;
    if (!slot || !frozen || stepRef.current !== 2) return;

    const { width, height } = slot.getBoundingClientRect();
    const fit = computeFormPreviewFit(
      frozen.previewWrapWidth,
      frozen.previewWrapHeight,
      width,
      height,
    );
    if (fit) setFormPreviewLayout(fit);
  }, []);

  useLayoutEffect(() => {
    if (step !== 2 || !layoutVars) {
      setFormPreviewLayout(null);
      return;
    }

    measureFormPreview();

    const slot = canvasSlotRef.current;
    if (!slot) return;

    const observer = new ResizeObserver(() => measureFormPreview());
    observer.observe(slot);
    return () => observer.disconnect();
  }, [step, layoutVars, formExpanded, measureFormPreview]);

  const scheduleReturnToDraw = useCallback(() => {
    setFormShown(false);
    clearFormTimers();
    deferFormStep(() => {
      setFormExpanded(false);
      deferFormStep(() => setStep(1));
    });
  }, [clearFormTimers, deferFormStep]);

  const isDrawStep = step === 1;
  const isFormStep = step === 2;
  const isPhoneLandscapeDraw = isDrawStep && isPhoneLandscape;

  useLayoutEffect(() => {
    if (!isDrawStep || !hasDrawn) {
      setColorRowFade(false);
      return;
    }

    const row = colorRowRef.current;
    const tools = row?.parentElement;
    const toolbar = row?.closest(".canvas-toolbar");
    if (!row || !tools) return;

    const syncColorRowFade = () => {
      const canScrollRight =
        row.scrollWidth > tools.clientWidth + 1 &&
        row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      setColorRowFade(canScrollRight);
    };

    syncColorRowFade();
    row.addEventListener("scroll", syncColorRowFade, { passive: true });
    const observer = new ResizeObserver(syncColorRowFade);
    if (toolbar) observer.observe(toolbar);

    return () => {
      row.removeEventListener("scroll", syncColorRowFade);
      observer.disconnect();
    };
  }, [isDrawStep, hasDrawn]);

  const drawCanvasBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, []);

  const restoreCanvasSnapshot = useCallback((snapshot: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const image = new Image();
    image.onload = () => {
      const { width: logicalW, height: logicalH } = canvasLogicalSize(canvas);
      const drawW = logicalW > 0 ? logicalW : rect.width;
      const drawH = logicalH > 0 ? logicalH : rect.height;
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.drawImage(image, 0, 0, drawW, drawH);
      drawingSnapshotRef.current = canvas.toDataURL("image/png");
    };
    image.src = snapshot;
  }, []);

  const setupCanvas = useCallback(
    (snapshotOverride?: string | null) => {
      if (stepRef.current !== 1) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (isPhoneLandscapeViewport() && portraitCanvasSizeRef.current) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const bufferWidth = canvas.width > 0 ? canvas.width / dpr : 0;
      const bufferHeight = canvas.height > 0 ? canvas.height / dpr : 0;
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      const snapshot =
        snapshotOverride !== undefined
          ? snapshotOverride
          : hasDrawnRef.current && bufferWidth > 0
            ? canvas.toDataURL("image/png")
            : drawingSnapshotRef.current;

      if (
        snapshotOverride === undefined &&
        bufferWidth > 0 &&
        Math.abs(bufferWidth - cssWidth) < 1 &&
        Math.abs(bufferHeight - cssHeight) < 1
      ) {
        return;
      }

      if (isPhonePortraitViewport() && !portraitCanvasSizeRef.current) {
        const size = { width: cssWidth, height: cssHeight };
        portraitCanvasSizeRef.current = size;
        setPortraitCanvasSize(size);
      }

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      if (snapshot) {
        restoreCanvasSnapshot(snapshot);
      } else {
        drawCanvasBackground();
      }
    },
    [drawCanvasBackground, restoreCanvasSnapshot],
  );

  useLayoutEffect(() => {
    if (isPhoneLandscapeDraw) {
      wasPhoneLandscapeDrawRef.current = true;
      return;
    }
    if (!isDrawStep || !wasPhoneLandscapeDrawRef.current) return;
    wasPhoneLandscapeDrawRef.current = false;
    requestAnimationFrame(() => setupCanvas());
  }, [isDrawStep, isPhoneLandscapeDraw, setupCanvas]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.screen?.orientation?.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.screen?.orientation?.removeEventListener("change", onResize);
    };
  }, [setupCanvas]);

  useEffect(() => {
    if (!isDrawStep) return;

    const id = window.setTimeout(() => {
      if (layoutVarsRef.current && editingSnapshotRef.current) {
        setupCanvas(editingSnapshotRef.current);
        layoutVarsRef.current = null;
        setLayoutVars(null);
      }
    }, TRANSITION_MS);

    return () => window.clearTimeout(id);
  }, [isDrawStep, setupCanvas]);

  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stack = undoStackRef.current;
    stack.push(canvas.toDataURL("image/png"));
    if (stack.length > MAX_UNDO) stack.shift();
    setCanUndo(true);
  }, []);

  const undoLastStroke = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;

    setCanUndo(undoStackRef.current.length > 0);
    restoreCanvasSnapshot(snapshot);

    if (undoStackRef.current.length === 0) {
      hasDrawnRef.current = false;
      setHasDrawn(false);
      drawingSnapshotRef.current = null;
    }
  }, [restoreCanvasSnapshot]);

  const canvasPos = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const { width: logicalW, height: logicalH } = canvasLogicalSize(canvas);
    const scaleX = logicalW > 0 ? logicalW / rect.width : 1;
    const scaleY = logicalH > 0 ? logicalH / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawStep || isPhoneLandscapeDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    pushUndoSnapshot();

    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
      setErrCanvas("");
    }

    const point = canvasPos(event);
    lastPointRef.current = point;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
  };

  const moveDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !isDrawStep || isPhoneLandscapeDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = canvasPos(event);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const endDraw = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (
      canvas &&
      event?.pointerId != null &&
      canvas.hasPointerCapture(event.pointerId)
    ) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (canvas && hasDrawnRef.current) {
      drawingSnapshotRef.current = canvas.toDataURL("image/png");
    }
  };

  const freezeCanvasLayout = () => {
    const slot = canvasSlotRef.current;
    const canvas = canvasRef.current;
    if (!slot || !canvas) return null;

    const slotRect = slot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const previewWrapWidth = canvasRect.width;
    const previewWrapHeight = canvasRect.height;
    const formFit = computeFormPreviewFit(
      previewWrapWidth,
      previewWrapHeight,
      slotRect.width,
      slotRect.height,
    );
    if (!formFit) return null;

    const layout: FrozenCanvasLayout = {
      width: slotRect.width,
      height: slotRect.height,
      previewWrapWidth,
      previewWrapHeight,
      previewWidth: formFit.previewWidth,
      previewHeight: formFit.previewHeight,
      previewScale: formFit.previewScale,
    };

    layoutVarsRef.current = layout;
    setLayoutVars(layout);
    setFormPreviewLayout(formFit);
    return layout;
  };

  const handleContinue = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return;

    const exported = exportCroppedTransparentPng(canvas);
    if (!exported) return;

    const layout = freezeCanvasLayout();
    if (!layout) return;

    editingSnapshotRef.current = canvas.toDataURL("image/png");
    setCapturedDrawing(exported.dataUrl);
    setDrawingSize({ width: exported.width, height: exported.height });
    setFormShown(false);
    setFormExpanded(true);
    setStep(2);
  };

  const handleActivateCanvas = () => {
    if (step !== 2) return;
    scheduleReturnToDraw();
  };

  const clearErrors = () => {
    setErrCanvas("");
    setErrName("");
    setErrHandle("");
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();

    if (!hasDrawn || !capturedDrawing) {
      setErrCanvas("Draw or sign before adding your page");
      setStep(1);
      return;
    }

    let valid = true;
    const trimmedName = name.trim();
    const trimmedHandle = handle.trim();

    if (!trimmedName) {
      setErrName("Add your name");
      valid = false;
    }

    if (!trimmedHandle) {
      setErrHandle("Add your profile");
      valid = false;
    }

    if (!valid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/memento/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          socialType,
          socialHandle: trimmedHandle,
          message: message.trim(),
          drawing: capturedDrawing,
        }),
      });

      if (!response.ok) {
        throw new Error("Submit failed");
      }

      if (!mountedRef.current) return;

      setConfirmName(trimmedName);
      setConfirmSocialType(socialType);
      setStep(3);
      replayStepAnimation(confirmStepRef.current);
    } catch {
      if (mountedRef.current) {
        setFormError("Couldn't save that, check your connection and try again.");
      }
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const previewDisplay = getPreviewDisplay(layoutVars, isFormStep, formPreviewLayout);

  const flowStyle =
    previewDisplay != null
      ? ({
          "--preview-w": `${previewDisplay.previewWidth}px`,
          "--preview-h": `${previewDisplay.previewHeight}px`,
          "--preview-scale": `${previewDisplay.previewScale}`,
        } as CSSProperties)
      : undefined;

  const wrapStyle = layoutVars
    ? ({
        width: `${isFormStep ? layoutVars.previewWrapWidth : layoutVars.width}px`,
        height: `${isFormStep ? layoutVars.previewWrapHeight : layoutVars.height}px`,
      } as CSSProperties)
    : undefined;

  const portraitLockStyle =
    isPhoneLandscapeDraw && portraitCanvasSize
      ? ({
          width: `${portraitCanvasSize.width}px`,
          height: `${portraitCanvasSize.height}px`,
        } as CSSProperties)
      : undefined;

  const confirmPreviewSize =
    drawingSize != null
      ? fitPreviewSize(drawingSize.width, drawingSize.height, 120, 200)
      : null;

  const confirmHostProfile = MEMENTO_HOST_PROFILES[confirmSocialType];

  return (
    <div className="memento-root">
      <div className="page">
        {isPhoneLandscapeDraw ? (
          <div className="rotation-lock-overlay" role="status" aria-live="polite">
            <RefreshDouble
              width={28}
              height={28}
              strokeWidth={1.75}
              color="currentColor"
              aria-hidden
            />
            <p>Lock phone rotation or return to portrait mode</p>
          </div>
        ) : null}
        {(isDrawStep || isFormStep) && (
          <div
            className={`memento-flow${isDrawStep ? " layout-draw" : " layout-form"}${isPhoneLandscapeDraw ? " is-phone-landscape" : ""}`}
            style={flowStyle}
          >
            <h1 className="memento-title">Leave your mark</h1>

            <div
              ref={canvasSlotRef}
              className="canvas-slot"
              onClick={isFormStep ? handleActivateCanvas : undefined}
              onKeyDown={
                isFormStep
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleActivateCanvas();
                      }
                    }
                  : undefined
              }
              role={isFormStep ? "button" : undefined}
              tabIndex={isFormStep ? 0 : undefined}
              aria-label={isFormStep ? "Edit your piece" : undefined}
            >
              <div className="canvas-scaler">
                <div
                  className={`canvas-wrap${isDrawStep ? " is-active" : " is-inactive"}${isPhoneLandscapeDraw ? " is-rotation-locked" : ""}`}
                  style={{ ...portraitLockStyle, ...wrapStyle }}
                >
                  <canvas
                    ref={canvasRef}
                    aria-label="Draw or sign here"
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    onPointerCancel={endDraw}
                  />
                  <span className={`canvas-hint${hasDrawn ? " hidden" : ""}`}>
                    draw or sign here
                  </span>
                  <div className="canvas-toolbar">
                    <div
                      className={`color-tools${colorRowFade ? " has-scroll-fade" : ""}`}
                    >
                      <div
                        ref={colorRowRef}
                        className="color-row"
                        role="group"
                        aria-label="Choose a color"
                      >
                        {MEMENTO_COLORS.map(({ color, label }) => (
                          <button
                            key={color}
                            type="button"
                            className={`swatch${currentColor === color ? " active" : ""}`}
                            style={{ "--c": color } as CSSProperties}
                            data-color={color}
                            aria-label={label}
                            onClick={(event) => {
                              event.stopPropagation();
                              setCurrentColor(color);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={`canvas-actions${hasDrawn ? " is-visible" : ""}`}>
                      <button
                        type="button"
                        className={`undo-action-btn${hasDrawn ? " is-visible" : ""}`}
                        disabled={!canUndo}
                        aria-label="Undo"
                        onClick={(event) => {
                          event.stopPropagation();
                          undoLastStroke();
                        }}
                      >
                        <Undo width={16} height={16} strokeWidth={2} color="currentColor" />
                        Undo
                      </button>
                      <button
                        type="button"
                        className={`next-btn${hasDrawn ? " is-visible" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleContinue();
                        }}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {errCanvas ? (
                <p className="field-error canvas-error" id="errCanvas">
                  {errCanvas}
                </p>
              ) : null}
            </div>

            <form
              className={`form-panel${formExpanded ? " is-expanded" : ""}${formShown ? " is-shown" : ""}`}
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="form-panel-body">
                <div className="field">
                  <input
                    type="text"
                    id="nameInput"
                    placeholder="Your name"
                    autoComplete="name"
                    aria-label="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <p className="field-error">{errName}</p>
                </div>

                <MementoSocialField
                  socialType={socialType}
                  handle={handle}
                  error={errHandle}
                  onSocialTypeChange={setSocialType}
                  onHandleChange={setHandle}
                />

                <div className="field">
                  <input
                    type="text"
                    id="messageInput"
                    placeholder="Leave a message (optional)"
                    aria-label="Leave a message (optional)"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add to guestbook"}
                </button>
                <p className="form-error">{formError}</p>
              </div>
            </form>
          </div>
        )}

        <div
          ref={confirmStepRef}
          className="step"
          hidden={step !== 3}
          id="step3"
        >
          <div className="confirm-body">
            {capturedDrawing ? (
              <img
                className="confirm-preview"
                src={capturedDrawing}
                alt="Your drawing"
                style={
                  confirmPreviewSize
                    ? {
                        width: confirmPreviewSize.width,
                        height: confirmPreviewSize.height,
                      }
                    : undefined
                }
              />
            ) : null}
            <p className="confirm-sub">
              Thanks {confirmName} for leaving a memorable moment this Config
              season.
            </p>
            <a
              className="confirm-social-link"
              href={confirmHostProfile.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={confirmHostProfile.favicon}
                alt=""
                width={16}
                height={16}
                draggable={false}
              />
              {confirmHostProfile.label}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
