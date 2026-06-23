import type { SocialType } from "@/app/components/mementoColors";

export type MementoDevConfirmPreview = {
  name: string;
  drawing: string;
  size: { width: number; height: number };
  socialType?: SocialType;
};

export const DEV_CONFIRM_PREVIEW: MementoDevConfirmPreview = {
  name: "Alex",
  socialType: "twitter",
  drawing: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M12 52 Q36 18 60 44 T108 28" stroke="#0a0908" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  )}`,
  size: { width: 120, height: 80 },
};

export function isDevConfirmStepSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("step") === "3" || params.has("step=3");
}

export function isDevConfirmStepParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  const step = params.step;
  if (step === "3") return true;
  if (Array.isArray(step) && step.includes("3")) return true;
  return Object.hasOwn(params, "step=3");
}

export function resolveDevConfirmPreview(
  params: Record<string, string | string[] | undefined>,
): MementoDevConfirmPreview | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!isDevConfirmStepParams(params)) return null;
  return DEV_CONFIRM_PREVIEW;
}

export function applyDevConfirmPreviewState(
  preview: MementoDevConfirmPreview,
  setters: {
    setStep: (step: 3) => void;
    setConfirmName: (name: string) => void;
    setConfirmSocialType: (type: SocialType) => void;
    setCapturedDrawing: (drawing: string) => void;
    setDrawingSize: (size: { width: number; height: number }) => void;
  },
) {
  setters.setConfirmName(preview.name);
  setters.setConfirmSocialType(preview.socialType ?? "twitter");
  setters.setCapturedDrawing(preview.drawing);
  setters.setDrawingSize(preview.size);
  setters.setStep(3);
}
