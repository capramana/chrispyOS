export const VAULT_POSTIT_COLLAPSED = 140;
export const VAULT_POSTIT_EXPANDED = 320;
export const VAULT_POSTIT_BASE_PADDING = 16;
export const VAULT_POSTIT_MAX_QUOTE_PX = 32;
export const VAULT_POSTIT_MAX_ATTRIBUTION_PX = 24;
export const VAULT_POSTIT_MIN_FIT_SCALE = 0.2;
export const VAULT_POSTIT_FIT_STEP = 0.01;

export type PostItFontFit = {
  quotePx: number;
  attributionPx: number;
};

export function fitPostItFonts(
  quote: string,
  author: string,
  boxSize: number,
  paddingPx: number,
): PostItFontFit {
  if (typeof document === "undefined") {
    return {
      quotePx: VAULT_POSTIT_MAX_QUOTE_PX,
      attributionPx: VAULT_POSTIT_MAX_ATTRIBUTION_PX,
    };
  }

  const measurer = document.createElement("div");
  measurer.style.position = "fixed";
  measurer.style.left = "-9999px";
  measurer.style.top = "0";
  measurer.style.visibility = "hidden";
  measurer.style.pointerEvents = "none";
  measurer.style.fontFamily = '"Biro Script", cursive';
  measurer.style.fontWeight = "400";
  measurer.style.boxSizing = "border-box";

  const quoteEl = document.createElement("p");
  quoteEl.style.margin = "0";
  quoteEl.style.lineHeight = "1.3";
  quoteEl.style.overflowWrap = "break-word";
  quoteEl.textContent = quote;

  const authorEl = document.createElement("p");
  authorEl.style.margin = "1.5em 0 0";
  authorEl.style.lineHeight = "1.2";
  authorEl.style.overflowWrap = "break-word";
  authorEl.textContent = author;

  measurer.append(quoteEl, authorEl);
  document.body.appendChild(measurer);

  const available = boxSize - paddingPx * 2;
  measurer.style.width = `${available}px`;

  let scale = 1;
  quoteEl.style.fontSize = `${VAULT_POSTIT_MAX_QUOTE_PX}px`;
  authorEl.style.fontSize = `${VAULT_POSTIT_MAX_ATTRIBUTION_PX}px`;

  while (
    measurer.scrollHeight > available &&
    scale > VAULT_POSTIT_MIN_FIT_SCALE
  ) {
    scale -= VAULT_POSTIT_FIT_STEP;
    quoteEl.style.fontSize = `${VAULT_POSTIT_MAX_QUOTE_PX * scale}px`;
    authorEl.style.fontSize = `${VAULT_POSTIT_MAX_ATTRIBUTION_PX * scale}px`;
  }

  document.body.removeChild(measurer);

  return {
    quotePx: VAULT_POSTIT_MAX_QUOTE_PX * scale,
    attributionPx: VAULT_POSTIT_MAX_ATTRIBUTION_PX * scale,
  };
}

export function vaultPostItExpandLayout(
  viewportW: number,
  viewportH: number,
  expandedSize: number,
) {
  return {
    x: viewportW / 2 - expandedSize / 2,
    y: viewportH / 2 - expandedSize / 2,
  };
}
