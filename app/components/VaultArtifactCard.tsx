/** White mat inset on every side of the image (`variant="stacked"`). */
export const VAULT_STACKED_MAT_PADDING_PX = 4;
/** Corner radius on the outer mat and on the `<img>` (`variant="stacked"`). */
export const VAULT_STACKED_CORNER_RADIUS_PX = 4;

type VaultArtifactCardProps = {
  src: string;
  alt: string;
  maxWidth: number;
  maxHeight: number;
  caption?: string;
  /**
   * `stacked` — mat + hairline border for vault pile (`VAULT_STACKED_*` tokens).
   * Omit for flat mats used on standalone draggable artifacts.
   */
  variant?: "flat" | "stacked";
  /** Depth shadow for vault pile — must live on the rounded mat, not a square wrapper. */
  layerShadow?: string;
};

export default function VaultArtifactCard({
  src,
  alt,
  maxWidth,
  maxHeight,
  caption,
  variant = "flat",
  layerShadow,
}: VaultArtifactCardProps) {
  const stacked = variant === "stacked";
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
          ? "flex max-w-full w-fit flex-col items-stretch leading-none"
          : "inline-flex max-w-full flex-col items-stretch leading-none"
      }
      style={{
        padding: pad,
        backgroundColor: "#ffffff",
        borderRadius: r,
        border: stacked ? "1px solid color-mix(in srgb, var(--foreground) 14%, transparent)" : undefined,
        overflow: stacked ? "hidden" : undefined,
        boxShadow: stacked && layerShadow ? layerShadow : undefined,
        contain: stacked ? "paint" : undefined,
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
          <img src={src} alt={alt} draggable={false} className="pointer-events-none" style={imgStyle} />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none block self-center"
          style={{
            ...imgStyle,
            borderRadius: 0,
          }}
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
