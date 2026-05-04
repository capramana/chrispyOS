# chrispyOS

Repository notes for anyone editing this codebase.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

## Stack

- **Next.js** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for utility classes
- **Framer Motion** for spring/layout animations
- **Iconoir React** + **React Feather** for icons

## Architecture

This is a single-page personal website. There are no actual routes — tab state (`home`, `writing`, `vault`) lives in `HomePage.tsx` and is passed into `NavBar`. Dark mode state stays local to `NavBar`. All interactive components are `"use client"`.

**Layout pattern**: Fixed-position elements around a centered hero. Components are placed in corners/edges of the viewport (clock bottom-left, work experience top-right, social handle bottom-right, etc.).

`app/page.tsx` renders `HomePage`. `app/layout.tsx` handles fonts and metadata.

## Theming (Dark Mode)

Dark mode is toggled by adding/removing the `dark` class on `document.documentElement` (done in `NavBar.tsx`). Theme toggle state is local to `NavBar` — it is not in a context or global store.

**CSS variables** in `globals.css` define all theme-aware tokens (`--background`, `--foreground`, `--color-primary`, `--color-secondary`, `--color-hushed`, `--music-player-bg`, `--music-player-border`, `--navbar-bg`, etc.). Light mode tokens live in `:root`, dark mode in `.dark`.

**Global transitions**: All elements get `transition: background-color 0.275s ease, border-color 0.275s ease, color 0.275s ease` via a `@layer base` rule. During a theme switch, `theme-transitioning` is briefly added to `<html>` to trigger blur effects on hero text and corner labels.

**When adding new theme-aware styles**: use CSS variables, not hardcoded colors. For transparent values in dark mode, use a color-matched `rgba(..., 0)` rather than `transparent` to avoid color-channel interpolation artifacts during the border-color transition.

## Styling Conventions

Three styling approaches are used — pick the right one:


| Approach            | When used                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Tailwind classes    | Layout, spacing, flex/grid, basic colors                                                        |
| Inline `style={{}}` | Theme-aware values via CSS variables, dynamic transforms (rotation, opacity driven by JS state) |
| Custom CSS file     | Complex effects: chiseled text shadows, icon keyframe animations, neon glow filters             |


Each component that needs custom CSS has its own `.css` file alongside the `.tsx` (e.g., `NavBar.css`, `NavButton.css`, `ChisledText.css`).

## Key Components

- **`NavBar.tsx`** — owns dark mode state; receives tab props from `HomePage`; Framer Motion layout animations for expand/collapse (spring: stiffness 1100, damping 60, mass 2)
- **`HomePage.tsx`** — client shell: tab state and composes fixed layout + center content (`home`/`writing` hero vs `Vault`)
- **`VaultArtifacts.tsx`** / **`VaultPictureStack.tsx`** / **`VaultArtifact.tsx`** / **`vaultRects.ts`** — vault tab: draggable stacks; **picture stacks** use Cambio-style Framer `layoutId` zoom (see **Cambio-style shared layout zoom** and **Vault zoom captions** below). Zoom captions live on **`VaultArtifactCard`**, not as a separate portal block. Other vault pieces use `VaultArtifact.tsx`. Stack priority + z-index: touch promotes to top unless the piece is **covered** by a higher stack sibling—then promotion waits until it **no longer overlaps** those blockers (see `deferredRef` in `VaultArtifacts.tsx`)
- **`NavButton.tsx`** — icon swap animations with CSS keyframe sequences (sunrise/sunset metaphor for moon/sun)
- **`ChisledText.tsx`** — metallic 3D text effect via `background-clip`, `text-stroke`, and layered `text-shadow`
- **`Graffiti.tsx`** — dark-mode-only idle neon doodles; 30s idle timer; collision-detects against UI elements before placing SVGs
- **`MusicPlayer.tsx`** — album art spins via `requestAnimationFrame` (360° per 3s); hover reveals playback controls
- **`WorkExperience.tsx`** — cascading card reveal on hover with staggered opacity/transform transitions

## Cambio-style shared layout zoom (vault → reference for other assets)

This documents what worked (and what did not) while implementing a **Cambio-like** interaction: a small source tile morphs into a large “focused” tile using **Framer Motion** shared layout (`layoutId`) plus a **portalled** overlay. Primary implementation: `VaultPictureStack.tsx` (`VaultOverlayPortal`, grid, `createPortal`).

### Core pattern

1. **`LayoutGroup`** — Wrap every surface that participates in the same shared transition (e.g. the draggable stack root **and** the in-page gallery overlay shell). Give the group a **stable `id`** per stack so multiple stacks do not cross-wire `layoutId`s.

2. **Stable `layoutId` strings** — One id per **logical asset**, not per React instance index, e.g. `` `vault-${stackId}-art-${assetId}` ``. Source (grid button) and destination (portal card) must use the **identical** string.

3. **Matched timing** — Use the **same** `transition` (duration + ease) on every shared `motion` node that should read as one gesture (`VAULT_MORPH_DURATION_S` / `vaultMorphTransition`). Optional: a portalled dim scrim synced to that tween; **pictures** skip the scrim and rely on **grid opacity** on non-focused tiles (`opacity-[0.32]`).

4. **`createPortal(..., document.body)`** — Renders the zoom layer above **stacking context** / `overflow` issues from ancestors. Keep a **fixed** full-viewport shell with **horizontal bleed** past `100vw` if the in-page gallery uses `overflow-y: auto` (horizontal clip otherwise cuts the morphing card at the edges).

5. **Invisible grid placeholder** — When an item is focused, the grid cell can render an **invisible** copy of the thumbnail (same footprint) so the grid does not reflow while the visible `layoutId` lives in the portal.

### Z-index: zoom **out** (critical)

When `focusAssetId` clears, the morphing tile **lost** lift and drew **under** neighbors.

- **Cause**: Clearing both `liftAssetId` and `focusAssetId` immediately removed the “lifted” stacking for the tile that was still animating back into the grid.
- **Fix**: On dismiss, set **`liftAssetId` to the exiting focused id**, then `setFocusAssetId(null)`. After **`VAULT_MORPH_MS`** (same as morph duration), clear `liftAssetId`. Use a **single timeout ref**; cancel it when opening a new focus or closing the whole overlay.
- **Overlay shell**: Use elevated `z-index` while **`focusAssetId != null || liftAssetId != null`**, not only when focused—otherwise the whole gallery layer drops mid-morph.

### Layout / CSS: why the zoomed card looked “stuck” at thumb size

- **Flex default `flex-shrink: 1`** on the centered wrapper let the flex item **shrink below** the computed zoom dimensions.
- **`max-w-full`** on `VaultArtifactCard` (stacked) then capped the card to that **shrunk** width.

**Fix**: `shrink-0` on the zoom wrappers; **`clampToParent={false}`** on the portalled card so stacked mode **omits `max-w-full`** (thumbnails in the grid keep default `clampToParent`).

### Zoom **size** math (what we simplified)

- **`vaultFocusZoomSize`**: `scale = min(maxScale, capW/baseW, capH/baseH)` with viewport-derived caps (`~0.94` / `~0.92` of `innerWidth`/`innerHeight` minus padding). **`maxScale`** is often **not** the binding term; **`capH/baseH`** usually is for portrait-ish thumb slots (e.g. 140×175).
- **Portrait vs landscape cap**: We used **`baseH > baseW`** on the **thumb slot** for `4.5` vs `6`. Using **intrinsic image** dimensions for that choice is possible but adds `onLoadingComplete` plumbing and still loses to viewport height caps unless you redesign the cap model.

**What did not pay off** (removed from the codebase; do not reintroduce blindly):

- Per-item `focusZoomMaxScale`, custom viewport fracs, or **ResizeObserver** on the overlay “usable rect” — user-visible size barely moved because **height / slot** still dominated, and **CSS** / flex were masking gains.
- **`min(..., capW/cw, capH/ch)`** “content footprint” without tightening the **slot** in the same step — can imply a scale the **full mat** does not fit; keep slot and viewport constraints **one coherent `min()` chain** if you extend this.

### Reuse checklist for books / text / other vault assets

- [ ] One **`LayoutGroup`** id per family of shared elements.
- [ ] Identical **`layoutId`** on source and destination `motion` wrappers only where morph should run.
- [ ] Portal layer + **aligned** transition durations on shared layout; optional dim scrim (pictures: grid-only dimming).
- [ ] **Lift + delayed clear** on dismiss so z-order survives the morph home.
- [ ] **`shrink-0`** + avoid **`max-w-full`** (or equivalent) on the **large** destination so flex does not negate JS size.
- [ ] Optional: invisible source placeholder so grid layout does not jump.
- [ ] Test **Escape**, backdrop click, and **click another tile** while zoomed—all dismiss paths must run the same lift logic.

### File map (pictures)

| Piece | Role |
| ----- | ---- |
| `VaultPictureStack.tsx` | `LayoutGroup`, drag pile, expanded grid, `dismissVaultFocus`, portal `createPortal`, `vaultFocusZoomSize` |
| `VaultOverlayPortal` | Centered `motion.span` + `VaultArtifactCard` only (captions live **on** the card, not as a portal sibling) |
| `VaultArtifactCard.tsx` | Mat + image + optional footer (`caption` / `captionYear` / `captionUrl`); `clampToParent` for portal zoom; stacked radii + padding tokens |
| `VaultArtifacts.tsx` | `PICTURE_ITEMS` catalog, `VaultPictureStack` wiring |

### Vault zoom captions (what worked vs. what failed)

Zoom copy is easy to get wrong because **three different “widths”** exist at once:

1. **`zoomW` / `zoomH`** from `vaultFocusZoomSize` — the **layout cap** passed into `next/image`.
2. **Painted bitmap** — often smaller than `zoomW` when `object-fit: contain` is **height-limited** (`w-fit` card shrinks).
3. **Outer mat** — image slot + `VAULT_STACKED_MAT_PADDING_PX` + border (`VAULT_STACKED_BORDER_PX`).

**What worked (restored pattern):** render the caption **inside `VaultArtifactCard`**, below the image, in the same white column. Give the footer row **`style={{ maxWidth }}` using the same `maxWidth` prop as the image wrapper.** Then the text cannot be wider than the image slot by construction—no `ResizeObserver`, no second width model to disagree with Framer.

**What failed (avoid reintroducing):**

- **Portal-only caption** as a sibling under `layoutId` — easy to end up with **shrink-to-fit** columns where caption **min-content** widens the flex parent, or with widths derived from **`vaultStackedPrintOuterWidthPx(zoomW)`** while the real card is **narrower** (height-limited `contain`) → caption **bleeds** past the photo.
- **`ResizeObserver` + `getBoundingClientRect` on `<img>`** during / after **`layoutId`** morph — layout boxes can lag **painted** size; caption followed a **thumbnail-width** rect and looked ~⅓ of the visible image.
- **Any extra DOM node between `motion` and `VaultArtifactCard`** on one side of the morph but not the other — breaks shared layout projection; keep **grid and portal identical**: `motion.span.inline-block` → **card directly** (refs/observers attach to that `motion` node only if you must measure, and prefer in-card width first).

**Layout / copy details that stuck:**

- **`layoutId` host**: `motion.span` with `inline-block overflow-visible`, wrapping the card only (matches the grid cell).
- **Links**: when `captionUrl` is set, the whole footer row is one `<a>`; **`gap-x-[16px]`** between left copy and year + `ArrowUpRight` (Iconoir).
- **Spacing**: picture → caption vertical gap **`mt-[4px]`**; mat padding **`VAULT_STACKED_MAT_PADDING_PX`** (4px); outer mat radius **`VAULT_STACKED_CORNER_RADIUS_PX`** (8px); inner image clip radius **`VAULT_STACKED_IMAGE_CORNER_RADIUS_PX`** (6px).

**`PICTURE_ITEMS` ordering:** `VaultPictureStack`’s collapsed preview uses the **last `PREVIEW_CARD_COUNT`** entries. New prints that should **not** change the preview pile must be inserted **earlier** in the array (e.g. before Falcon) so the tail stays e.g. Falcon → Jobs → Yeltsin.

