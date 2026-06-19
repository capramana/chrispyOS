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
- **`VaultArtifacts.tsx`** / **`VaultPictureStack.tsx`** / **`VaultBook.tsx`** / **`VaultCartridgeStack.tsx`** / **`VaultPostIt.tsx`** / **`VaultArtifact.tsx`** / **`vaultRects.ts`** — vault tab: draggable stacks; picture stacks follow **`Expandable Stacked Div Prototype.html`** (`computeLayout`, portaled expand). `VaultBook` is a draggable 3D book with open/close overlay. `VaultCartridgeStack` is a draggable Game Boy cartridge fan that expands into a scrollable list + GBA SP shell (YouTube playback). `VaultPostIt` is a draggable quote note (tap to expand, rotation settles to 0°). Touch or open promotes an artifact to the top z-index (`VaultArtifacts.tsx`). `VaultArtifactCard` is for non-picture artifacts; picture captions live only on `VaultPictureItem` data while stacked.
- **`NavButton.tsx`** — icon swap animations with CSS keyframe sequences (sunrise/sunset metaphor for moon/sun)
- **`ChisledText.tsx`** — metallic 3D text effect via `background-clip`, `text-stroke`, and layered `text-shadow`
- **`Graffiti.tsx`** — dark-mode-only idle neon doodles; 30s idle timer; collision-detects against UI elements before placing SVGs
- **`MusicPlayer.tsx`** — album art spins via `requestAnimationFrame` (360° per 3s); hover reveals playback controls
- **`WorkExperience.tsx`** — cascading card reveal on hover with staggered opacity/transform transitions

## Vault picture stack (`VaultPictureStack.tsx`)

Same behavior as **`Expandable Stacked Div Prototype.html`**: `clamp`, `overlaps`, `inBounds`, **`computeLayout`**, **`GAP` / `PAD`**, **`VIS`** (`[0, 1, 2]`) and **`ROTS`**, **`CARD_TRANSITION`**. Tap the pile to expand (portaled cards + backdrop). White mat frames around `<img>`; no Framer `layoutId` morph. Escape collapses the gallery when no image is zoomed (see **Zoom**).

**`PICTURE_ITEMS` in `VaultArtifacts.tsx`:** only the first three entries match **`VIS`** in the collapsed pile—prepend if a new print should show there.

**Zoom:** grid tile and modal share a `view-transition-name` with class `vault-cambio` (see `globals.css`). With zoom open, Escape or backdrop closes zoom only and leaves the pile expanded; otherwise backdrop collapses the gallery.

- **`classifyGalleryAnchor`** — Still drives **`galleryOriginForAnchor`** only; the stack’s **center** can fall in the broad `nearCenter` zone even when the pile feels “on the left”; internal row math no longer depends on that for column alignment.

### State (picture stack)

- **`focusAssetId`** — Zoomed asset while the modal is “open”.
- **`morphHandoffId`** — Exit handoff only: portal + grid `layoutId` stay paired after `focusAssetId` clears.
- **`liftAssetId`** — Pointer-down “lift” under cursor and z-order hint; cleared with `morphHandoffId` after morph timeout. Not interchangeable with `morphHandoffId` for portal props.

Pictures use **grid opacity** on non-focused tiles while zoomed (no extra dim scrim). **`vaultFocusZoomSize`**: `min(maxScale, capW/baseW, capH/baseH)`; portrait vs landscape **`maxScale`** from thumb aspect (`4.5` vs `6`).

**`PICTURE_ITEMS`**: collapsed preview is the **last `PREVIEW_CARD_COUNT`** items; insert new prints earlier if the visible pile tail should stay the same.
