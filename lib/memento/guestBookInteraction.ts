import type { BookLayout } from "@/lib/memento/guestBookFlip";

export function resolveGuestBookPageDismiss(
  pageNumber: number,
  step: number,
  animating: boolean,
  layout: BookLayout,
  closeBook: () => void,
  dismissBackCover: () => void,
): (() => void) | undefined {
  if (animating) return undefined;
  if (step === 1 && pageNumber === 1) return closeBook;
  if (step === layout.maxStep && pageNumber === layout.pageCount) {
    return dismissBackCover;
  }
  return undefined;
}

export function resolveGuestBookDrawingClick(
  pageNumber: number,
  step: number,
  animating: boolean,
  frontClosed: boolean,
  backClosed: boolean,
  layout: BookLayout,
  goBack: () => void,
  goForward: () => void,
  closeBook: () => void,
  dismissBackCover: () => void,
): (() => void) | undefined {
  if (animating || frontClosed || backClosed || step < 1) return undefined;
  if (
    resolveGuestBookPageDismiss(
      pageNumber,
      step,
      animating,
      layout,
      closeBook,
      dismissBackCover,
    )
  ) {
    return undefined;
  }

  return pageNumber % 2 === 1 ? goBack : goForward;
}

export type GuestBookPageInteractionContext = {
  step: number;
  animating: boolean;
  frontClosed: boolean;
  backClosed: boolean;
  layout: BookLayout;
  goBack: () => void;
  goForward: () => void;
  closeBook: () => void;
  dismissBackCover: () => void;
};

export function guestBookPageInteraction(
  pageNumber: number,
  ctx: GuestBookPageInteractionContext,
) {
  return {
    onPageDismiss: resolveGuestBookPageDismiss(
      pageNumber,
      ctx.step,
      ctx.animating,
      ctx.layout,
      ctx.closeBook,
      ctx.dismissBackCover,
    ),
    onDrawingClick: resolveGuestBookDrawingClick(
      pageNumber,
      ctx.step,
      ctx.animating,
      ctx.frontClosed,
      ctx.backClosed,
      ctx.layout,
      ctx.goBack,
      ctx.goForward,
      ctx.closeBook,
      ctx.dismissBackCover,
    ),
  };
}

export function resolveGuestBookForwardTurn(
  isBackCoverTarget: boolean,
  frontClosed: boolean,
  openFromBack: () => void,
  openBook: () => void,
  turnForward: () => void,
): () => void {
  if (isBackCoverTarget) return openFromBack;
  if (frontClosed) return openBook;
  return turnForward;
}
