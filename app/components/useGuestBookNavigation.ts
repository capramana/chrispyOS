"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GuestBookSearchEntry } from "@/lib/memento/guestBookPages";
import {
  GUEST_BOOK_BACK_CLOSED_STEP,
  GUEST_BOOK_COVER_TURN_MS,
  GUEST_BOOK_NAVIGATION_WAIT_TIMEOUT_MS,
  GUEST_BOOK_SEARCH_FLIP_STAGGER_RATIO,
  GUEST_BOOK_TURN_MS,
  guestBookAfterCoverAnimationMs,
  guestBookPause,
  guestBookWaitUntil,
} from "@/lib/memento/guestBookConstants";
import {
  clearGuestBookTimeoutRef,
  GUEST_BOOK_HIGHLIGHT_FADE_MS,
  GUEST_BOOK_HOVER_FADE_IN_MS,
  guestBookSearchFlipStaggerMs,
  guestBookSearchFlipTotalMs,
  guestBookSearchFlipWindowProgress,
  guestBookSearchHighlightDismissDelay,
  guestBookSearchHighlightForEntry,
  type GuestBookSearchFlip,
  type GuestBookSearchHighlight,
  type GuestBookSearchProfilePin,
} from "@/lib/memento/guestBookSearch";
import {
  playGuestBookCoverSound,
  playGuestBookPageShuffleSound,
  playGuestBookPageTurnSound,
  stopAllGuestBookPageSounds,
} from "@/lib/memento/guestBookPageTurnSound";

export type UseGuestBookNavigationOptions = {
  maxStep: number;
};

export function useGuestBookNavigation({ maxStep }: UseGuestBookNavigationOptions) {
  const [step, setStep] = useState(0);
  const [prevStep, setPrevStep] = useState(0);
  const stepRef = useRef(step);
  const prevStepRef = useRef(prevStep);
  const lockedRef = useRef(false);
  const lockTimerRef = useRef<number | null>(null);
  const returningToFrontRef = useRef(false);

  const searchNavigatingRef = useRef(false);
  const [searchNavigating, setSearchNavigating] = useState(false);
  const [searchFlip, setSearchFlip] = useState<GuestBookSearchFlip | null>(null);
  const [searchRiffleMs, setSearchRiffleMs] = useState(0);
  const [searchHighlight, setSearchHighlight] =
    useState<GuestBookSearchHighlight | null>(null);
  const [searchProfileFadingOut, setSearchProfileFadingOut] = useState(false);
  const [searchProfilePin, setSearchProfilePin] =
    useState<GuestBookSearchProfilePin | null>(null);
  const [searchProfileCssFadeIn, setSearchProfileCssFadeIn] = useState(false);
  const searchHighlightTimerRef = useRef<number | null>(null);
  const searchProfilePinTimerRef = useRef<number | null>(null);
  const searchProfilePinDelayTimerRef = useRef<number | null>(null);
  const navigationGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const searchProfilePinned = searchProfilePin !== null;

  const playRiffleSounds = useCallback((flipCount: number, durationMs: number) => {
    if (flipCount >= 2) {
      playGuestBookPageShuffleSound(durationMs);
      return;
    }
    if (flipCount === 1) {
      playGuestBookPageTurnSound(durationMs);
    }
  }, []);

  useLayoutEffect(() => {
    stepRef.current = step;
  }, [step]);

  useLayoutEffect(() => {
    prevStepRef.current = prevStep;
  }, [prevStep]);

  useLayoutEffect(() => {
    searchNavigatingRef.current = searchNavigating;
  }, [searchNavigating]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAllGuestBookPageSounds();
    };
  }, []);

  useEffect(() => {
    if (!searchFlip) {
      setSearchRiffleMs(0);
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;
    const tick = () => {
      setSearchRiffleMs(performance.now() - startedAt);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [searchFlip]);

  const settleStep = useCallback(() => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockedRef.current = false;
    setPrevStep(stepRef.current);
  }, []);

  const lock = useCallback(
    (durationMs: number = GUEST_BOOK_TURN_MS) => {
      lockedRef.current = true;
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
      }
      lockTimerRef.current = window.setTimeout(settleStep, durationMs);
    },
    [settleStep],
  );

  const applyStep = useCallback((next: number) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  const transitionCoverTo = useCallback(
    (next: number) => {
      if (lockedRef.current) return false;
      const from = stepRef.current;
      playGuestBookCoverSound(GUEST_BOOK_COVER_TURN_MS);
      lock(GUEST_BOOK_COVER_TURN_MS);
      setPrevStep(from);
      applyStep(next);
      return true;
    },
    [applyStep, lock],
  );

  const openBook = useCallback(() => {
    return transitionCoverTo(1);
  }, [transitionCoverTo]);

  const closeBook = useCallback(() => {
    transitionCoverTo(0);
  }, [transitionCoverTo]);

  const openFromBack = useCallback(() => {
    return transitionCoverTo(maxStep);
  }, [maxStep, transitionCoverTo]);

  const turnForward = useCallback(() => {
    if (lockedRef.current) return;
    const current = stepRef.current;
    if (current >= maxStep) {
      transitionCoverTo(GUEST_BOOK_BACK_CLOSED_STEP);
      return;
    }
    playGuestBookPageTurnSound(GUEST_BOOK_TURN_MS);
    lock(GUEST_BOOK_TURN_MS);
    applyStep(current + 1);
  }, [applyStep, lock, maxStep, transitionCoverTo]);

  const turnBack = useCallback(() => {
    if (lockedRef.current) return;
    const current = stepRef.current;
    if (current <= 1) return;
    playGuestBookPageTurnSound(GUEST_BOOK_TURN_MS);
    lock();
    applyStep(current - 1);
  }, [applyStep, lock]);

  const awaitNavigation = useCallback(
    async (condition: () => boolean, context: string): Promise<boolean> => {
      const ok = await guestBookWaitUntil(condition, {
        timeoutMs: GUEST_BOOK_NAVIGATION_WAIT_TIMEOUT_MS,
      });
      if (ok) return true;

      if (process.env.NODE_ENV === "development") {
        console.warn(`Guest book navigation wait timed out: ${context}`);
      }
      settleStep();
      setSearchFlip(null);
      return false;
    },
    [settleStep],
  );

  const releaseNavigation = useCallback(() => {
    searchNavigatingRef.current = false;
    if (mountedRef.current) {
      setSearchFlip(null);
      setSearchNavigating(false);
    }
  }, []);

  const goForward = useCallback(() => {
    if (stepRef.current === GUEST_BOOK_BACK_CLOSED_STEP) return;
    if (stepRef.current === 0) openBook();
    else turnForward();
  }, [openBook, turnForward]);

  const goBack = useCallback(() => {
    if (stepRef.current === GUEST_BOOK_BACK_CLOSED_STEP) openFromBack();
    else if (stepRef.current <= 1) closeBook();
    else turnBack();
  }, [closeBook, openFromBack, turnBack]);

  const clearSearchProfilePinDelayTimer = useCallback(() => {
    clearGuestBookTimeoutRef(searchProfilePinDelayTimerRef);
  }, []);

  const clearSearchProfilePin = useCallback(() => {
    clearSearchProfilePinDelayTimer();
    setSearchProfilePin(null);
    setSearchProfileCssFadeIn(false);
    setSearchProfileFadingOut(false);
  }, [clearSearchProfilePinDelayTimer]);

  const pinSearchProfile = useCallback(
    (entry: GuestBookSearchEntry, cssFadeIn: boolean) => {
      clearSearchProfilePinDelayTimer();
      setSearchProfilePin({ entryId: entry.id, pageNumber: entry.pageNumber });
      setSearchProfileCssFadeIn(cssFadeIn);
      setSearchProfileFadingOut(false);
    },
    [clearSearchProfilePinDelayTimer],
  );

  const clearSearchHighlightTimers = useCallback(() => {
    clearGuestBookTimeoutRef(searchHighlightTimerRef);
    clearGuestBookTimeoutRef(searchProfilePinTimerRef);
  }, []);

  const applySearchHighlight = useCallback((entry: GuestBookSearchEntry) => {
    setSearchHighlight(guestBookSearchHighlightForEntry(entry));
  }, []);

  const resetSearchPresentation = useCallback(() => {
    clearSearchHighlightTimers();
    clearSearchProfilePin();
    setSearchHighlight(null);
    setSearchProfileFadingOut(false);
  }, [clearSearchHighlightTimers, clearSearchProfilePin]);

  const searchProfileFadeOpacity = useMemo((): number | null => {
    if (!searchProfilePinned || searchProfileFadingOut || !searchFlip) {
      return null;
    }

    return guestBookSearchFlipWindowProgress(
      searchFlip,
      searchRiffleMs,
      GUEST_BOOK_HOVER_FADE_IN_MS,
    );
  }, [searchProfilePinned, searchProfileFadingOut, searchFlip, searchRiffleMs]);

  const scheduleSearchHighlightDismiss = useCallback(
    (delayMs: number) => {
      clearSearchHighlightTimers();
      searchHighlightTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setSearchHighlight(null);
        searchHighlightTimerRef.current = null;
        window.requestAnimationFrame(() => {
          if (!mountedRef.current) return;
          setSearchProfileFadingOut(true);
        });
        searchProfilePinTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return;
          clearSearchProfilePin();
          searchProfilePinTimerRef.current = null;
        }, GUEST_BOOK_HIGHLIGHT_FADE_MS);
      }, delayMs);
    },
    [clearSearchHighlightTimers, clearSearchProfilePin],
  );

  useEffect(
    () => () => {
      clearGuestBookTimeoutRef(searchHighlightTimerRef);
      clearGuestBookTimeoutRef(searchProfilePinTimerRef);
      clearGuestBookTimeoutRef(searchProfilePinDelayTimerRef);
    },
    [],
  );

  const runRiffleToStep = useCallback(
    async (
      targetStep: number,
      entry: GuestBookSearchEntry | undefined,
      stillActive: () => boolean,
    ) => {
      const fromStep = stepRef.current;
      const stepsToGo = Math.abs(targetStep - fromStep);

      if (stepsToGo === 0) {
        if (entry) {
          pinSearchProfile(entry, true);
          applySearchHighlight(entry);
          scheduleSearchHighlightDismiss(guestBookSearchHighlightDismissDelay(0));
        }
        return;
      }

      const staggerMs = guestBookSearchFlipStaggerMs(
        GUEST_BOOK_TURN_MS,
        GUEST_BOOK_SEARCH_FLIP_STAGGER_RATIO,
      );
      const flipAnim: GuestBookSearchFlip = {
        fromStep,
        toStep: targetStep,
        flipMs: GUEST_BOOK_TURN_MS,
        staggerMs,
      };
      const flipTotalMs = guestBookSearchFlipTotalMs(flipAnim);

      if (entry) {
        const profilePinDelayMs = Math.max(
          0,
          flipTotalMs - GUEST_BOOK_HOVER_FADE_IN_MS,
        );

        applySearchHighlight(entry);
        scheduleSearchHighlightDismiss(
          guestBookSearchHighlightDismissDelay(flipTotalMs),
        );

        searchProfilePinDelayTimerRef.current = window.setTimeout(() => {
          searchProfilePinDelayTimerRef.current = null;
          if (!stillActive()) return;
          pinSearchProfile(entry, false);
        }, profilePinDelayMs);
      }

      setPrevStep(fromStep);
      setSearchFlip(flipAnim);
      playRiffleSounds(stepsToGo, flipTotalMs);

      await guestBookPause(flipTotalMs + 50);
      if (!stillActive()) return;

      clearSearchProfilePinDelayTimer();
      applyStep(targetStep);
      setPrevStep(targetStep);
      setSearchFlip(null);
    },
    [
      applyStep,
      pinSearchProfile,
      applySearchHighlight,
      scheduleSearchHighlightDismiss,
      clearSearchProfilePinDelayTimer,
      playRiffleSounds,
    ],
  );

  const navigateToStep = useCallback(
    async (
      targetStep: number,
      presentation?: { entry: GuestBookSearchEntry },
    ) => {
      if (searchNavigatingRef.current || returningToFrontRef.current) return;

      const generation = ++navigationGenerationRef.current;
      const stillActive = () =>
        mountedRef.current && generation === navigationGenerationRef.current;

      const clampedTarget = Math.min(maxStep, Math.max(0, targetStep));
      const entry = presentation?.entry;

      searchNavigatingRef.current = true;
      setSearchNavigating(true);

      try {
        if (entry) {
          resetSearchPresentation();
        }

        if (
          (stepRef.current === GUEST_BOOK_BACK_CLOSED_STEP ||
            stepRef.current === 0) &&
          clampedTarget >= 1
        ) {
          if (stepRef.current === GUEST_BOOK_BACK_CLOSED_STEP) openFromBack();
          else openBook();
          await guestBookPause(guestBookAfterCoverAnimationMs());
          if (!stillActive()) return;
        }

        if (!(await awaitNavigation(() => !lockedRef.current, "navigateToStep:lockIdle"))) {
          return;
        }
        if (!stillActive()) return;

        await runRiffleToStep(clampedTarget, entry, stillActive);
      } finally {
        releaseNavigation();
      }
    },
    [
      maxStep,
      awaitNavigation,
      openBook,
      openFromBack,
      resetSearchPresentation,
      runRiffleToStep,
      releaseNavigation,
    ],
  );

  const navigateToEntry = useCallback(
    async (entry: GuestBookSearchEntry) => {
      if (searchNavigatingRef.current || returningToFrontRef.current) return;

      const targetStep = Math.min(
        maxStep,
        Math.max(1, guestBookSearchHighlightForEntry(entry).spreadStep),
      );
      await navigateToStep(targetStep, { entry });
    },
    [maxStep, navigateToStep],
  );

  const isBusy = useCallback(
    () =>
      lockedRef.current ||
      searchNavigatingRef.current ||
      returningToFrontRef.current,
    [],
  );

  const navigateBookToStep = useCallback(
    async (targetStep: number, stillActive: () => boolean) => {
      const target = Math.max(
        GUEST_BOOK_BACK_CLOSED_STEP,
        Math.min(maxStep, targetStep),
      );

      const advancePastCover = async (
        open: () => boolean,
        settledAt: () => boolean,
        label: string,
      ): Promise<"continue" | "abort" | "retry"> => {
        if (!open()) {
          if (!(await awaitNavigation(() => !lockedRef.current, `${label}:waitLock`))) {
            return "abort";
          }
          if (!open()) return "retry";
        }

        await guestBookPause(guestBookAfterCoverAnimationMs());
        if (!(await awaitNavigation(() => !lockedRef.current, `${label}:lock`))) {
          return "abort";
        }
        if (!stillActive()) return "abort";
        if (!(await awaitNavigation(settledAt, `${label}:settled`))) return "abort";
        return "continue";
      };

      let current = stepRef.current;
      if (current === target) return;

      while (current !== target) {
        if (!stillActive()) return;

        if (!(await awaitNavigation(() => !lockedRef.current, "navigateBookToStep:lockIdle"))) {
          return;
        }
        if (!stillActive()) return;

        current = stepRef.current;
        if (current === target) return;

        if (current === GUEST_BOOK_BACK_CLOSED_STEP) {
          const result = await advancePastCover(
            openFromBack,
            () =>
              stepRef.current === maxStep &&
              prevStepRef.current === stepRef.current,
            "openFromBack",
          );
          if (result === "abort") return;
          if (result === "retry") continue;
          current = stepRef.current;
          continue;
        }

        if (current === 0) {
          if (target <= 0) return;
          const result = await advancePastCover(
            openBook,
            () =>
              stepRef.current >= 1 &&
              prevStepRef.current === stepRef.current,
            "openBook",
          );
          if (result === "abort") return;
          if (result === "retry") continue;
          current = stepRef.current;
          continue;
        }

        if (target === 0) {
          if (current > 1) {
            await runRiffleToStep(1, undefined, stillActive);
            if (!(await awaitNavigation(() => !lockedRef.current, "navigateBookToStep:toStep1:lock"))) {
              return;
            }
            if (!stillActive()) return;
            if (!(await awaitNavigation(() => stepRef.current <= 1, "navigateBookToStep:toStep1:step"))) {
              return;
            }
            current = stepRef.current;
            continue;
          }

          setSearchFlip(null);
          closeBook();
          await guestBookPause(guestBookAfterCoverAnimationMs());
          return;
        }

        await runRiffleToStep(target, undefined, stillActive);
        if (!(await awaitNavigation(() => !lockedRef.current, "navigateBookToStep:afterRiffle:lock"))) {
          return;
        }
        if (!stillActive()) return;
        if (!(await awaitNavigation(() => stepRef.current === target, "navigateBookToStep:target"))) {
          return;
        }
        current = stepRef.current;
      }
    },
    [
      awaitNavigation,
      closeBook,
      maxStep,
      openBook,
      openFromBack,
      runRiffleToStep,
    ],
  );

  const returnToFrontCover = useCallback(async () => {
    if (
      returningToFrontRef.current ||
      searchNavigatingRef.current ||
      stepRef.current === 0
    ) {
      return;
    }

    returningToFrontRef.current = true;
    searchNavigatingRef.current = true;
    setSearchNavigating(true);

    const generation = ++navigationGenerationRef.current;
    const stillActive = () =>
      mountedRef.current && generation === navigationGenerationRef.current;

    try {
      if (!(await awaitNavigation(() => !lockedRef.current, "returnToFrontCover:lockIdle"))) {
        return;
      }
      if (!stillActive() || stepRef.current === 0) return;

      await navigateBookToStep(0, stillActive);
    } finally {
      returningToFrontRef.current = false;
      releaseNavigation();
    }
  }, [awaitNavigation, navigateBookToStep, releaseNavigation]);

  return {
    step,
    prevStep,
    stepRef,
    prevStepRef,
    lockedRef,
    searchNavigatingRef,
    searchNavigating,
    searchFlip,
    searchRiffleMs,
    searchHighlight,
    searchProfilePin,
    searchProfileCssFadeIn,
    searchProfileFadingOut,
    searchProfilePinned,
    searchProfileFadeOpacity,
    navigateToEntry,
    openBook,
    openFromBack,
    turnForward,
    goForward,
    goBack,
    closeBook,
    returnToFrontCover,
    isBusy,
    settleStep,
  };
}
