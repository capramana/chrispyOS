export const CARTRIDGE_CARD_W = 150;
export const CARTRIDGE_CARD_H = 86;
export const CARTRIDGE_GAP = 20;
export const CARTRIDGE_STEP_V = CARTRIDGE_CARD_H + CARTRIDGE_GAP;
export const CARTRIDGE_STEP_H = CARTRIDGE_CARD_W + CARTRIDGE_GAP;
export const CARTRIDGE_FAN_SCALE = 0.8;
export const CARTRIDGE_COUNT = 11;
export const CARTRIDGE_ANIM_MS = 650;
/** Must match `transform`/`left`/`top` duration in `VaultCartridgeStack.css`. */
export const CARTRIDGE_TRANSITION_MS = 600;
export const CARTRIDGE_PANEL_W = 310;
export const CARTRIDGE_PANEL_H = 553;
export const CARTRIDGE_PANEL_GAP_MOBILE = 40;
export const CARTRIDGE_PANEL_GAP_DESKTOP = 80;
export const CARTRIDGE_MOBILE_BREAKPOINT = 768;
export const CARTRIDGE_VISIBLE_FAN = 3;

export const CARTRIDGE_SCATTER = [
  { ox: -70, oy: -70, rotate: -12 },
  { ox: 70, oy: -65, rotate: 10 },
  { ox: -25, oy: 20, rotate: 4 },
] as const;

export function isCartridgeMobile(viewportW: number) {
  return viewportW < CARTRIDGE_MOBILE_BREAKPOINT;
}

export function cartridgeCardSlot(i: number) {
  if (i === 0) return -1;
  if (i === 1) return 0;
  const rank = Math.ceil(i / 2);
  return i % 2 === 0 ? rank : -rank;
}

const minSlot = -Math.floor(CARTRIDGE_COUNT / 2);

export function buildCartridgeSlotOrder() {
  const order = new Array<number>(CARTRIDGE_COUNT);
  for (let i = 0; i < CARTRIDGE_COUNT; i++) {
    order[cartridgeCardSlot(i) - minSlot] = i;
  }
  return order;
}

export const CARTRIDGE_SLOT_ORDER = buildCartridgeSlotOrder();

export type CartridgeGroupLayout = {
  panelX: number;
  panelY: number;
  cardX: number;
  cardY: number;
};

export function cartridgeGroupLayout(
  viewportW: number,
  viewportH: number,
  mobile: boolean,
): CartridgeGroupLayout {
  if (mobile) {
    const totalH =
      CARTRIDGE_PANEL_H + CARTRIDGE_PANEL_GAP_MOBILE + CARTRIDGE_CARD_H;
    const startY = viewportH / 2 - totalH / 2;
    return {
      panelX: viewportW / 2 - CARTRIDGE_PANEL_W / 2,
      panelY: startY,
      cardX: viewportW / 2 - CARTRIDGE_CARD_W / 2,
      cardY: startY + CARTRIDGE_PANEL_H + CARTRIDGE_PANEL_GAP_MOBILE,
    };
  }

  const totalW = CARTRIDGE_CARD_W + CARTRIDGE_PANEL_GAP_DESKTOP + CARTRIDGE_PANEL_W;
  const startX = viewportW / 2 - totalW / 2;
  return {
    cardX: startX,
    cardY: viewportH / 2 - CARTRIDGE_CARD_H / 2,
    panelX: startX + CARTRIDGE_CARD_W + CARTRIDGE_PANEL_GAP_DESKTOP,
    panelY: viewportH / 2 - CARTRIDGE_PANEL_H / 2,
  };
}

export function cartridgeExpandedXY(
  cardIndex: number,
  layout: CartridgeGroupLayout,
  mobile: boolean,
) {
  const slot = cartridgeCardSlot(cardIndex);
  if (mobile) {
    return {
      x: layout.cardX + slot * CARTRIDGE_STEP_H,
      y: layout.cardY,
    };
  }
  return {
    x: layout.cardX,
    y: layout.cardY + slot * CARTRIDGE_STEP_V,
  };
}

export function cartridgeNeedsScroll(viewportW: number, viewportH: number, mobile: boolean) {
  if (mobile) {
    return CARTRIDGE_COUNT * CARTRIDGE_STEP_H > viewportW;
  }
  return CARTRIDGE_COUNT * CARTRIDGE_STEP_V > viewportH;
}

export function cartridgeScatterFixedPos(
  cardIndex: number,
  pileX: number,
  pileY: number,
  footprintW: number,
  footprintH: number,
  fanScale: number = CARTRIDGE_FAN_SCALE,
  pileScale = 1,
) {
  const cardW = CARTRIDGE_CARD_W * fanScale;
  const cardH = CARTRIDGE_CARD_H * fanScale;
  const fanOriginX = pileX + footprintW / 2 - cardW / 2;
  const fanOriginY = pileY + footprintH / 2 - cardH / 2;

  if (cardIndex < CARTRIDGE_VISIBLE_FAN) {
    const s = CARTRIDGE_SCATTER[cardIndex % CARTRIDGE_SCATTER.length]!;
    return {
      x: fanOriginX + s.ox * pileScale,
      y: fanOriginY + s.oy * pileScale,
      rotate: s.rotate,
      scale: fanScale,
      opacity: 1,
    };
  }

  return {
    x: fanOriginX,
    y: fanOriginY,
    rotate: 0,
    scale: fanScale,
    opacity: 0,
  };
}

export function heroCartridgeTransitionDelay(
  cardIndex: number,
  heroPose: "scatter" | "list",
) {
  if (heroPose === "list") {
    return Math.abs(cartridgeCardSlot(cardIndex)) * 55;
  }
  if (cardIndex < CARTRIDGE_VISIBLE_FAN) return cardIndex * 60;
  return Math.abs(cartridgeCardSlot(cardIndex)) * 55;
}

export function cartridgeHeroShouldStagger(mobile: boolean, collapsing: boolean) {
  return (mobile && collapsing) || (!mobile && !collapsing);
}

export function heroCartridgeMaxDelay(heroPose: "scatter" | "list") {
  let max = 0;
  for (let i = 0; i < CARTRIDGE_COUNT; i++) {
    max = Math.max(max, heroCartridgeTransitionDelay(i, heroPose));
  }
  return max;
}

export function cartridgeHeroAnimMs(heroPose: "scatter" | "list") {
  return CARTRIDGE_TRANSITION_MS + heroCartridgeMaxDelay(heroPose);
}

export function cartridgeRepCardPos(
  row: number,
  scroll: number,
  layout: CartridgeGroupLayout,
  mobile: boolean,
) {
  const centerRow = -minSlot;
  const step = mobile ? CARTRIDGE_STEP_H : CARTRIDGE_STEP_V;
  const wrap = CARTRIDGE_COUNT * step;

  if (mobile) {
    const baseX = layout.cardX + (row - centerRow) * step;
    const wrapMin = layout.cardX - centerRow * step;
    let x = baseX + scroll;
    x = ((((x - wrapMin) % wrap) + wrap) % wrap) + wrapMin;
    return { x, y: layout.cardY };
  }

  const baseY = layout.cardY + (row - centerRow) * step;
  const wrapMin = layout.cardY - centerRow * step;
  let y = baseY + scroll;
  y = ((((y - wrapMin) % wrap) + wrap) % wrap) + wrapMin;
  return { x: layout.cardX, y };
}
