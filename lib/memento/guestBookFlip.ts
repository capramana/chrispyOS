import {
  GUEST_BOOK_BACK_CLOSED_STEP,
  GUEST_BOOK_COVER_TURN_MS,
  GUEST_BOOK_COVER_TURN_TRANSITION,
  GUEST_BOOK_TURN_MS,
  GUEST_BOOK_TURN_TRANSITION,
} from "@/lib/memento/guestBookConstants";
import type { GuestBookSearchFlip } from "@/lib/memento/guestBookSearch";

export type BookLayout = {
  pageCount: number;
  maxStep: number;
  sheetCount: number;
};

export function createBookLayout(pageCount: number): BookLayout {
  return {
    pageCount,
    maxStep: pageCount / 2,
    sheetCount: pageCount / 2 + 1,
  };
}

function flipTransition(ms: number) {
  return { duration: ms / 1000, ease: GUEST_BOOK_TURN_TRANSITION.ease } as const;
}

function sheetTransitionFor(step: number, prevStep: number, maxStep: number) {
  if (isCoverTransition(step, prevStep, maxStep)) {
    return { rotateY: GUEST_BOOK_COVER_TURN_TRANSITION, z: { duration: 0 } } as const;
  }
  return { rotateY: flipTransition(GUEST_BOOK_TURN_MS), z: { duration: 0 } } as const;
}

export function turnDurationMs(step: number, prevStep: number, maxStep: number) {
  return isCoverTransition(step, prevStep, maxStep)
    ? GUEST_BOOK_COVER_TURN_MS
    : GUEST_BOOK_TURN_MS;
}

type CoverTransitionKind =
  | "front-open"
  | "front-close"
  | "back-open"
  | "back-close"
  | null;

/**
 * Single spec for cover flips — derived from first principles:
 *
 * - Front cover: sheet 0 front is always leather; back may swap page ↔ leather on close.
 * - Back cover open/close mirrors front open/close on the opposite side.
 *   Always-mounted flipper (page endpaper + leather back) while the real last sheet
 *   is hidden — avoids Framer mount snap. Penultimate sheet stays in 3D for page 9
 *   (never flat/hidden). Stationary back-cover OFF (right side is the flipper).
 * - Static spread pages use flat layers so a flipping sheet never occludes them (front
 *   close: flat right page while sheet 0 closes on the left).
 * - Stage slides in sync with the flip toward its settled closed/open offset.
 */
export type CoverTransitionSpec = {
  kind: CoverTransitionKind;
  stagePct: number;
  showBoard: boolean;
  showStationaryBackCover: boolean;
  showSpine: boolean;
  hideSheetIndices: ReadonlySet<number>;
  flatRightPage: number | null;
};

function backCoverFlipSpec(
  kind: "back-open" | "back-close",
  stagePct: number,
  layout: BookLayout,
): CoverTransitionSpec {
  return {
    kind,
    stagePct,
    showBoard: spreadUsesBoard(layout.maxStep),
    showStationaryBackCover: false,
    showSpine: true,
    hideSheetIndices: new Set([layout.sheetCount - 1]),
    flatRightPage: null,
  };
}

export function getCoverTransitionSpec(
  step: number,
  prevStep: number,
  layout: BookLayout,
): CoverTransitionSpec {
  const { maxStep } = layout;
  const animating = prevStep !== step;
  const none: CoverTransitionSpec = {
    kind: null,
    stagePct:
      step === GUEST_BOOK_BACK_CLOSED_STEP ? 50 : step >= 1 || (animating && prevStep >= 1) ? 0 : -50,
    showBoard: spreadUsesBoard(animating && prevStep >= 1 ? prevStep : step),
    showStationaryBackCover:
      !frontCoverClosed(step, prevStep) &&
      !backCoverClosed(step, prevStep) &&
      !isBackCoverClosing(step, prevStep, maxStep) &&
      !isBackCoverOpening(step, prevStep, maxStep) &&
      (step >= 1 || (animating && prevStep >= 1)),
    showSpine: step >= 1 || (animating && prevStep >= 1),
    hideSheetIndices: new Set(),
    flatRightPage: null,
  };

  if (!animating) {
    return {
      ...none,
      stagePct: step === GUEST_BOOK_BACK_CLOSED_STEP ? 50 : step >= 1 ? 0 : -50,
      showBoard: spreadUsesBoard(step),
      showStationaryBackCover: step >= 1,
      showSpine: step >= 1,
    };
  }

  if (isCoverOpening(step, prevStep)) {
    return {
      kind: "front-open",
      stagePct: 0,
      showBoard: false,
      showStationaryBackCover: true,
      showSpine: true,
      hideSheetIndices: new Set<number>(),
      flatRightPage: null,
    };
  }

  if (isCoverClosing(step, prevStep)) {
    const rightSheet = rightSheetIndex(prevStep);
    return {
      kind: "front-close",
      stagePct: -50,
      showBoard: false,
      showStationaryBackCover: true,
      showSpine: true,
      hideSheetIndices: new Set([rightSheet]),
      flatRightPage: frontPageNumber(rightSheet, layout),
    };
  }

  if (isBackCoverOpening(step, prevStep, maxStep)) {
    return backCoverFlipSpec("back-open", 0, layout);
  }

  if (isBackCoverClosing(step, prevStep, maxStep)) {
    return backCoverFlipSpec("back-close", 50, layout);
  }

  return none;
}

function sheetIsTurned(sheetIndex: number, step: number) {
  if (step === GUEST_BOOK_BACK_CLOSED_STEP) return true;
  return step > sheetIndex;
}

function sheetFlipsInSearch(sheetIndex: number, searchFlip: GuestBookSearchFlip) {
  return (
    sheetIsTurned(sheetIndex, searchFlip.toStep) !==
    sheetIsTurned(sheetIndex, searchFlip.fromStep)
  );
}

function searchFlipSheetOrder(
  sheetIndex: number,
  searchFlip: GuestBookSearchFlip,
): number {
  if (searchFlip.toStep > searchFlip.fromStep) {
    return sheetIndex - searchFlip.fromStep;
  }
  return searchFlip.fromStep - 1 - sheetIndex;
}

function searchFlipSheetDelayMs(
  sheetIndex: number,
  searchFlip: GuestBookSearchFlip,
): number {
  return Math.max(0, searchFlipSheetOrder(sheetIndex, searchFlip)) * searchFlip.staggerMs;
}

const SEARCH_FLIP_NO_TRANSITION = {
  rotateY: { duration: 0 },
  z: { duration: 0 },
} as const;

/** 0–1 progress for one sheet's turn during search (scrub-style, driven by rAF). */
function searchSheetFlipProgress(
  sheetIndex: number,
  searchFlip: GuestBookSearchFlip,
  elapsedMs: number,
): number {
  if (!sheetFlipsInSearch(sheetIndex, searchFlip)) return 1;
  const delay = searchFlipSheetDelayMs(sheetIndex, searchFlip);
  const { flipMs } = searchFlip;
  if (elapsedMs <= delay) return 0;
  if (elapsedMs >= delay + flipMs) return 1;
  return (elapsedMs - delay) / flipMs;
}

function searchSheetRotateY(
  sheetIndex: number,
  searchFlip: GuestBookSearchFlip,
  elapsedMs: number,
): number {
  const fromAngle = sheetIsTurned(sheetIndex, searchFlip.fromStep) ? -180 : 0;
  const toAngle = sheetIsTurned(sheetIndex, searchFlip.toStep) ? -180 : 0;
  if (fromAngle === toAngle) return fromAngle;
  const progress = searchSheetFlipProgress(sheetIndex, searchFlip, elapsedMs);
  return fromAngle + (toAngle - fromAngle) * progress;
}

function searchSheetTranslateZ(
  sheetIndex: number,
  searchFlip: GuestBookSearchFlip,
  elapsedMs: number,
  riffleStep: number,
  layout: BookLayout,
): number {
  const { sheetCount } = layout;
  const flipDistance = Math.abs(searchFlip.toStep - searchFlip.fromStep);

  if (sheetFlipsInSearch(sheetIndex, searchFlip)) {
    const progress = searchSheetFlipProgress(sheetIndex, searchFlip, elapsedMs);
    const order = searchFlipSheetOrder(sheetIndex, searchFlip);
    if (progress <= 0) return -0.5 - order * 0.03;
    if (progress >= 1) {
      return sheetIsTurned(sheetIndex, searchFlip.toStep)
        ? (sheetIndex + 1) * 0.05
        : -(sheetIndex + 1) * 0.05;
    }
    // Lift turning sheets above the stack; later sheets sit on top (CodePen z swap).
    return 0.5 + (flipDistance - order) * 0.04;
  }

  const left = leftSheetIndex(riffleStep);
  const right = rightSheetIndex(riffleStep);
  if (sheetIndex === left || sheetIndex === right) return 0;

  const goingForward = searchFlip.toStep > searchFlip.fromStep;
  for (let i = 0; i < sheetCount; i++) {
    if (!sheetFlipsInSearch(i, searchFlip)) continue;
    const progress = searchSheetFlipProgress(i, searchFlip, elapsedMs);
    if (progress <= 0 || progress >= 1) continue;
    const under = goingForward ? i + 1 : i - 1;
    if (sheetIndex === under) return -0.5;
  }

  return -10;
}

function resolveSheetTransition(
  sheetIndex: number,
  step: number,
  prevStep: number,
  maxStep: number,
  searchFlip: GuestBookSearchFlip | null,
) {
  if (searchFlip) {
    return SEARCH_FLIP_NO_TRANSITION;
  }

  return sheetTransitionFor(step, prevStep, maxStep);
}

function isCoverOpening(step: number, prevStep: number) {
  return prevStep !== step && step === 1 && prevStep === 0;
}

function isCoverClosing(step: number, prevStep: number) {
  return prevStep !== step && step === 0 && prevStep >= 1;
}

function isBackCoverClosing(step: number, prevStep: number, maxStep: number) {
  return prevStep !== step && step === GUEST_BOOK_BACK_CLOSED_STEP && prevStep === maxStep;
}

function isBackCoverOpening(step: number, prevStep: number, maxStep: number) {
  return prevStep !== step && step === maxStep && prevStep === GUEST_BOOK_BACK_CLOSED_STEP;
}

export function isCoverTransition(step: number, prevStep: number, maxStep: number) {
  return (
    isCoverOpening(step, prevStep) ||
    isCoverClosing(step, prevStep) ||
    isBackCoverClosing(step, prevStep, maxStep) ||
    isBackCoverOpening(step, prevStep, maxStep)
  );
}

export function frontCoverClosed(step: number, prevStep: number) {
  return step === 0 && prevStep === 0;
}

export function backCoverClosed(step: number, prevStep: number) {
  return step === GUEST_BOOK_BACK_CLOSED_STEP && prevStep === GUEST_BOOK_BACK_CLOSED_STEP;
}

function spreadUsesBoard(step: number) {
  return step >= 1 && leftSheetIndex(step) !== 0;
}

export function frontPageNumber(
  sheetIndex: number,
  layout: BookLayout,
): number | null {
  if (sheetIndex === 0) return null;
  if (sheetIndex === layout.sheetCount - 1) return layout.pageCount;
  return sheetIndex * 2;
}

export function backPageNumber(sheetIndex: number, layout: BookLayout): number | null {
  if (sheetIndex === 0) return 1;
  if (sheetIndex === layout.sheetCount - 1) return null;
  return sheetIndex * 2 + 1;
}

export function leftSheetIndex(step: number) {
  return step - 1;
}

export function rightSheetIndex(step: number) {
  return step;
}

export function pageOuterClass(pageNumber: number) {
  return pageNumber % 2 === 1
    ? "guest-book-half--page-outer-left"
    : "guest-book-half--page-outer-right";
}

export function computeSearchRiffleStep(
  searchFlip: GuestBookSearchFlip,
  elapsedMs: number,
): number {
  const { fromStep, toStep, flipMs, staggerMs } = searchFlip;
  if (fromStep === toStep) return fromStep;

  const goingForward = toStep > fromStep;
  const flipDistance = Math.abs(toStep - fromStep);
  let step = fromStep;

  for (let order = 0; order < flipDistance; order++) {
    const delay = order * staggerMs;
    if (elapsedMs >= delay + flipMs) {
      step += goingForward ? 1 : -1;
    } else {
      break;
    }
  }

  return goingForward
    ? Math.min(toStep, step)
    : Math.max(toStep, step);
}

function openBookCoverSpec(riffleStep: number): CoverTransitionSpec {
  return {
    kind: null,
    stagePct: 0,
    showBoard: spreadUsesBoard(riffleStep),
    showStationaryBackCover: riffleStep >= 1,
    showSpine: riffleStep >= 1,
    hideSheetIndices: new Set(),
    flatRightPage: null,
  };
}

export function searchCoverSpec(
  searchFlip: GuestBookSearchFlip,
  riffleStep: number,
): CoverTransitionSpec {
  const spec = openBookCoverSpec(riffleStep);
  if (searchFlip.fromStep >= 1) {
    spec.showSpine = true;
    spec.showStationaryBackCover = true;
  }
  return spec;
}

export function resolveSheetMotion(
  sheetIndex: number,
  step: number,
  prevStep: number,
  layout: BookLayout,
  searchFlip: GuestBookSearchFlip | null,
  riffleStep: number | null,
  riffleElapsedMs = 0,
) {
  if (searchFlip && riffleStep !== null) {
    const rotateY = sheetFlipsInSearch(sheetIndex, searchFlip)
      ? searchSheetRotateY(sheetIndex, searchFlip, riffleElapsedMs)
      : sheetIsTurned(sheetIndex, riffleStep)
        ? -180
        : 0;

    return {
      turned: rotateY <= -90,
      rotateY,
      translateZ: searchSheetTranslateZ(
        sheetIndex,
        searchFlip,
        riffleElapsedMs,
        riffleStep,
        layout,
      ),
      transition: SEARCH_FLIP_NO_TRANSITION,
    };
  }

  const turned = sheetIsTurned(sheetIndex, step);

  return {
    turned,
    rotateY: turned ? -180 : 0,
    translateZ: sheetTranslateZ(
      sheetIndex,
      step,
      prevStep,
      turned,
      layout,
      searchFlip,
      riffleStep,
    ),
    transition: resolveSheetTransition(
      sheetIndex,
      step,
      prevStep,
      layout.maxStep,
      searchFlip,
    ),
  };
}

function sheetTranslateZ(
  sheetIndex: number,
  step: number,
  prevStep: number,
  turned: boolean,
  layout: BookLayout,
  searchFlip: GuestBookSearchFlip | null = null,
  riffleStep: number | null = null,
) {
  const { maxStep, sheetCount } = layout;

  if (searchFlip && riffleStep !== null) {
    if (sheetFlipsInSearch(sheetIndex, searchFlip)) {
      const order = searchFlipSheetOrder(sheetIndex, searchFlip);
      return 0.5 - order * 0.04;
    }

    const left = leftSheetIndex(riffleStep);
    const right = rightSheetIndex(riffleStep);
    if (sheetIndex === left || sheetIndex === right) return 0;

    return -10;
  }

  if (isCoverTransition(step, prevStep, maxStep)) {
    if (isBackCoverClosing(step, prevStep, maxStep) ||
        isBackCoverOpening(step, prevStep, maxStep)) {
      if (sheetIndex === sheetCount - 1) return 0.5;
      if (sheetIndex === sheetCount - 2) return 0;
      return -10;
    }
    if (sheetIndex === 0) return 0.5;
    if (sheetIndex === 1) return -0.5;
    return -10;
  }

  const animating = prevStep !== step;

  const forwardInner =
    animating &&
    step > prevStep &&
    prevStep >= 1 &&
    !isCoverTransition(step, prevStep, maxStep);

  if (forwardInner) {
    if (sheetIndex === rightSheetIndex(prevStep)) return 0.5;
    if (sheetIndex === rightSheetIndex(step)) return -0.5;
  }

  if (step === 0) {
    if (sheetIndex === 0) return 0.5;
    return -10;
  }

  if (step === GUEST_BOOK_BACK_CLOSED_STEP) {
    if (sheetIndex === sheetCount - 1) return 0.5;
    return -10;
  }

  const left = leftSheetIndex(step);
  const right = rightSheetIndex(step);
  if (sheetIndex === left || sheetIndex === right) return 0;

  if (animating) {
    if (prevStep >= 1) {
      const prevLeft = leftSheetIndex(prevStep);
      const prevRight = rightSheetIndex(prevStep);
      if (sheetIndex === prevLeft || sheetIndex === prevRight) return 0;
    }
    if (sheetIsTurned(sheetIndex, step) !== sheetIsTurned(sheetIndex, prevStep)) {
      return 0;
    }
  }

  return turned ? (sheetIndex + 1) * 0.05 : -(sheetIndex + 1) * 0.05;
}

export function visibleSheetsForStep(
  step: number,
  prevStep: number,
  layout: BookLayout,
  coverSpec: CoverTransitionSpec,
  searchFlip: GuestBookSearchFlip | null = null,
  riffleStep: number | null = null,
  riffleElapsedMs = 0,
) {
  const visible = new Set<number>();
  const animating = prevStep !== step;
  const { maxStep, sheetCount } = layout;
  const lastSheet = sheetCount - 1;
  const { hideSheetIndices, kind } = coverSpec;

  const add = (index: number) => {
    if (!hideSheetIndices.has(index)) visible.add(index);
  };

  if (searchFlip && riffleStep !== null) {
    if (riffleStep >= 1) {
      add(leftSheetIndex(riffleStep));
      add(rightSheetIndex(riffleStep));
    }

    const goingForward = searchFlip.toStep > searchFlip.fromStep;
    for (let i = 0; i < sheetCount; i++) {
      if (!sheetFlipsInSearch(i, searchFlip)) continue;
      if (riffleElapsedMs >= searchFlipSheetDelayMs(i, searchFlip)) add(i);

      const progress = searchSheetFlipProgress(i, searchFlip, riffleElapsedMs);
      if (progress > 0 && progress < 1) {
        const peek = goingForward ? i + 1 : i - 1;
        if (peek >= 0 && peek < sheetCount) add(peek);
      }
    }
    return visible;
  }

  if (step === 0 && !animating) {
    visible.add(0);
    return visible;
  }

  if (step === GUEST_BOOK_BACK_CLOSED_STEP && !animating) {
    visible.add(lastSheet);
    return visible;
  }

  if (kind === "front-open") {
    visible.add(0);
    visible.add(1);
    return visible;
  }

  if (kind === "front-close") {
    visible.add(0);
    return visible;
  }

  if (kind === "back-open" || kind === "back-close") {
    if (maxStep - 1 >= 0) add(maxStep - 1);
    return visible;
  }

  if (step === 0 && animating) {
    add(0);
    add(rightSheetIndex(prevStep));
    for (let i = 0; i < sheetCount; i++) {
      if (sheetIsTurned(i, step) !== sheetIsTurned(i, prevStep)) {
        add(i);
      }
    }
    return visible;
  }

  if (step >= 1) {
    add(leftSheetIndex(step));
    add(rightSheetIndex(step));
  }

  if (animating) {
    for (let i = 0; i < sheetCount; i++) {
      if (sheetIsTurned(i, step) !== sheetIsTurned(i, prevStep)) {
        add(i);
      }
    }
    if (step > prevStep && prevStep >= 1) {
      add(leftSheetIndex(prevStep));
    }
    if (step < prevStep && step >= 1) {
      add(rightSheetIndex(prevStep));
    }
  }

  return visible;
}


export function getGuestBookRenderState(
  step: number,
  prevStep: number,
  layout: BookLayout,
  searchFlip: GuestBookSearchFlip | null,
  searchRiffleMs: number,
) {
  const coverTransitionActive = isCoverTransition(step, prevStep, layout.maxStep);
  const effectiveSearchFlip = coverTransitionActive ? null : searchFlip;
  const animating = effectiveSearchFlip !== null || prevStep !== step;
  const searchRiffleStep = effectiveSearchFlip
    ? computeSearchRiffleStep(effectiveSearchFlip, searchRiffleMs)
    : null;
  const coverSpec =
    effectiveSearchFlip && searchRiffleStep !== null
      ? searchCoverSpec(effectiveSearchFlip, searchRiffleStep)
      : getCoverTransitionSpec(step, prevStep, layout);
  const frontClosed = frontCoverClosed(step, prevStep);
  const backClosed = backCoverClosed(step, prevStep);

  const interactStep = effectiveSearchFlip
    ? effectiveSearchFlip.fromStep
    : step === GUEST_BOOK_BACK_CLOSED_STEP
      ? layout.maxStep
      : step === 0 && prevStep >= 1
        ? prevStep
        : step >= 1
          ? step
          : 0;

  const leftSheet = interactStep >= 1 ? leftSheetIndex(interactStep) : -1;
  const rightSheet =
    interactStep >= 1
      ? rightSheetIndex(interactStep)
      : frontClosed
        ? 0
        : backClosed
          ? layout.sheetCount - 1
          : -1;

  const visibleSheets = visibleSheetsForStep(
    step,
    prevStep,
    layout,
    coverSpec,
    effectiveSearchFlip,
    searchRiffleStep,
    searchRiffleMs,
  );

  return {
    animating,
    searchRiffleStep,
    coverSpec,
    frontClosed,
    backClosed,
    interactStep,
    leftSheet,
    rightSheet,
    visibleSheets,
    flatRightPage: coverSpec.flatRightPage,
    backCoverFlipActive:
      coverSpec.kind === "back-open" || coverSpec.kind === "back-close",
    activeStageTransition: isCoverTransition(step, prevStep, layout.maxStep)
      ? GUEST_BOOK_COVER_TURN_TRANSITION
      : GUEST_BOOK_TURN_TRANSITION,
  };
}
