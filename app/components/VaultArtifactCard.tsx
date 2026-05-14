import Image from "next/image";
import { ArrowUpRight } from "iconoir-react";

/** Legacy export for imports that still reference mat tokens. */
export const VAULT_STACKED_MAT_PADDING_PX = 4;
export const VAULT_STACKED_CORNER_RADIUS_PX = 8;
export const VAULT_STACKED_IMAGE_CORNER_RADIUS_PX = 4;

type VaultArtifactCardProps = {
  src: string;
  alt: string;
  maxWidth: number;
  maxHeight: number;
  sizes?: string;
  caption?: string;
  captionYear?: string;
  captionUrl?: string;
  layerShadow?: string;
  /** Omit max-w-full so flex shrink does not cap the enlarged card. */
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
  layerShadow,
  clampToParent = true,
}: VaultArtifactCardProps) {
  const sizes =
    sizesProp ??
    `(max-width: 640px) 90vw, (max-width: 1200px) 45vw, ${Math.max(320, Math.min(960, maxWidth * 6))}px`;
  const pad = 4;

  const link =
    captionUrl != null && captionUrl.trim() !== ""
      ? captionUrl.trim()
      : null;
  const showFooter =
    (caption != null && caption.trim() !== "") ||
    (captionYear != null && captionYear.trim() !== "");
  const rowClass =
    "flex w-full min-w-0 items-start justify-between gap-x-[16px]";
  const footerInner = (
    <>
      <div className="min-w-0 flex-1 text-left">
        {caption != null && caption.trim() !== "" ? <p>{caption}</p> : null}
      </div>
      {captionYear != null && captionYear.trim() !== "" ? (
        <div className="flex shrink-0 items-center gap-1">
          <span>{captionYear}</span>
          <ArrowUpRight
            className={`h-[11px] w-[11px] shrink-0${link != null ? "" : " opacity-50"}`}
            width={11}
            height={11}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      ) : null}
    </>
  );

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
      className={`inline-flex flex-col items-stretch leading-none${clampToParent ? " max-w-full" : ""}`}
      style={{
        padding: pad,
        backgroundColor: "#ffffff",
        borderRadius: 0,
        boxShadow: layerShadow,
      }}
    >
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
      {showFooter ? (
        <div
          className="mt-[4px] w-full min-w-0 font-mono text-[10px] leading-snug text-secondary"
          style={{ maxWidth }}
        >
          {link != null ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${rowClass} rounded-sm text-secondary no-underline underline-offset-2 hover:text-foreground hover:underline`}
            >
              {footerInner}
            </a>
          ) : (
            <div className={rowClass}>{footerInner}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
