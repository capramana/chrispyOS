import Image from "next/image";
import { ArrowUpRight } from "iconoir-react";

/** White mat inset on every side of the image (`variant="stacked"`). */
export const VAULT_STACKED_MAT_PADDING_PX = 4;
/** Hairline border on stacked variant (one side, px). */
export const VAULT_STACKED_BORDER_PX = 1;
/** Corner radius on the outer white mat / card (`variant="stacked"`). */
export const VAULT_STACKED_CORNER_RADIUS_PX = 8;
/** Corner radius on the clipped picture area inside the mat (`variant="stacked"`). */
export const VAULT_STACKED_IMAGE_CORNER_RADIUS_PX = 6;

type VaultArtifactCardProps = {
  src: string;
  alt: string;
  maxWidth: number;
  maxHeight: number;
  /** Passed to `next/image` `sizes` (layout hint). Defaults for grid + zoomed vault use. */
  sizes?: string;
  /** Optional footer under the image (vault zoom); width follows `maxWidth` like the original. */
  caption?: string;
  captionYear?: string;
  captionUrl?: string;
  /**
   * `stacked` — mat + hairline border for vault pile (`VAULT_STACKED_*` tokens).
   * Omit for flat mats used on standalone draggable artifacts.
   */
  variant?: "flat" | "stacked";
  /** Depth shadow for vault pile — must live on the rounded mat, not a square wrapper. */
  layerShadow?: string;
  /**
   * When false (vault zoom portal), omit `max-w-full` so the card is not capped to a flex-shrunk
   * parent — thumbnails in a grid should keep the default true.
   */
  clampToParent?: boolean;
};

export default function VaultArtifactCard({
  src,
  alt,
  maxWidth,
  maxHeight,
  sizes: sizesProp,
  caption,
  captionYear,
  captionUrl,
  variant = "flat",
  layerShadow,
  clampToParent = true,
}: VaultArtifactCardProps) {
  const stacked = variant === "stacked";
  const sizes =
    sizesProp ??
    `(max-width: 640px) 90vw, (max-width: 1200px) 45vw, ${Math.max(320, Math.min(960, maxWidth * 6))}px`;
  const r = stacked ? VAULT_STACKED_CORNER_RADIUS_PX : 0;
  const pad = stacked ? VAULT_STACKED_MAT_PADDING_PX : 4;

  const imgStyle = {
    maxWidth,
    maxHeight,
    width: "auto" as const,
    height: "auto" as const,
    objectFit: "contain" as const,
    backgroundColor: "#ffffff",
    display: "block" as const,
  };

  return (
    <div
      className={
        stacked
          ? `flex w-fit flex-col items-stretch leading-none${clampToParent ? " max-w-full" : ""}`
          : "inline-flex max-w-full flex-col items-stretch leading-none"
      }
      style={{
        padding: pad,
        backgroundColor: "#ffffff",
        borderRadius: r,
        border: stacked
          ? `${VAULT_STACKED_BORDER_PX}px solid color-mix(in srgb, var(--foreground) 14%, transparent)`
          : undefined,
        overflow: stacked ? "hidden" : undefined,
        boxShadow: stacked && layerShadow ? layerShadow : undefined,
      }}
    >
      {stacked ? (
        <div
          className="pointer-events-none self-center leading-[0]"
          style={{
            overflow: "hidden",
            borderRadius: VAULT_STACKED_IMAGE_CORNER_RADIUS_PX,
            maxWidth,
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={maxWidth}
            height={maxHeight}
            draggable={false}
            className="pointer-events-none"
            style={imgStyle}
            sizes={sizes}
          />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={maxWidth}
          height={maxHeight}
          draggable={false}
          className="pointer-events-none block self-center"
          style={{
            ...imgStyle,
            borderRadius: 0,
          }}
          sizes={sizes}
        />
      )}
      {stacked &&
      ((caption != null && caption.trim() !== "") ||
        (captionYear != null && captionYear.trim() !== "")) ? (
        <div
          className="mt-[4px] w-full min-w-0 font-mono text-[10px] leading-snug text-secondary"
          style={{ maxWidth }}
        >
          {(() => {
            const hasUrl =
              captionUrl != null && captionUrl.trim() !== "";
            const rowClass =
              "flex w-full min-w-0 items-start justify-between gap-x-[16px]";
            const inner = (
              <>
                <div className="min-w-0 flex-1 text-left">
                  {caption != null && caption.trim() !== "" ? (
                    <p>{caption}</p>
                  ) : null}
                </div>
                {captionYear != null && captionYear.trim() !== "" ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <span>{captionYear}</span>
                    <ArrowUpRight
                      className={`h-[11px] w-[11px] shrink-0${hasUrl ? "" : " opacity-50"}`}
                      width={11}
                      height={11}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                ) : null}
              </>
            );
            return hasUrl ? (
              <a
                href={captionUrl!.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className={`${rowClass} rounded-sm text-secondary no-underline underline-offset-2 hover:text-foreground hover:underline`}
              >
                {inner}
              </a>
            ) : (
              <div className={rowClass}>{inner}</div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
