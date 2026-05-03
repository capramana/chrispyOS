import Image from "next/image";

/** White mat inset on every side of the image (`variant="stacked"`). */
export const VAULT_STACKED_MAT_PADDING_PX = 4;
/** Corner radius on the outer mat and on the optimized image (`variant="stacked"`). */
export const VAULT_STACKED_CORNER_RADIUS_PX = 4;

type VaultArtifactCardProps = {
  src: string;
  alt: string;
  maxWidth: number;
  maxHeight: number;
  /** Passed to `next/image` `sizes` (layout hint). Defaults for grid + zoomed vault use. */
  sizes?: string;
  caption?: string;
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
        border: stacked ? "1px solid color-mix(in srgb, var(--foreground) 14%, transparent)" : undefined,
        overflow: stacked ? "hidden" : undefined,
        boxShadow: stacked && layerShadow ? layerShadow : undefined,
      }}
    >
      {stacked ? (
        <div
          className="pointer-events-none self-center leading-[0]"
          style={{
            overflow: "hidden",
            borderRadius: r,
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
      {caption != null && caption !== "" ? (
        <p
          className="mt-2 text-center font-mono text-[11px] leading-snug text-secondary"
          style={{ maxWidth }}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
