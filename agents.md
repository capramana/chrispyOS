# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

This is a single-page personal website. There are no actual routes — the navbar manages tab state (`home`, `writing`, `vault`) entirely client-side. All interactive components are `"use client"`.

**Layout pattern**: Fixed-position elements around a centered hero. Components are placed in corners/edges of the viewport (clock bottom-left, work experience top-right, social handle bottom-right, etc.).

**`app/page.tsx`** composes all components. **`app/layout.tsx`** handles fonts and metadata.

## Theming (Dark Mode)

Dark mode is toggled by adding/removing the `dark` class on `document.documentElement` (done in `NavBar.tsx`). Theme state is local to `NavBar` — it is not in a context or global store.

**CSS variables** in `globals.css` define all theme-aware tokens (`--background`, `--foreground`, `--color-primary`, `--color-secondary`, `--color-hushed`, `--music-player-bg`, `--music-player-border`, `--navbar-bg`, etc.). Light mode tokens live in `:root`, dark mode in `.dark`.

**Global transitions**: All elements get `transition: background-color 0.275s ease, border-color 0.275s ease, color 0.275s ease` via a `@layer base` rule. During a theme switch, `theme-transitioning` is briefly added to `<html>` to trigger blur effects on hero text and corner labels.

**When adding new theme-aware styles**: use CSS variables, not hardcoded colors. For transparent values in dark mode, use a color-matched `rgba(..., 0)` rather than `transparent` to avoid color-channel interpolation artifacts during the border-color transition.

## Styling Conventions

Three styling approaches are used — pick the right one:

| Approach | When used |
|---|---|
| Tailwind classes | Layout, spacing, flex/grid, basic colors |
| Inline `style={{}}` | Theme-aware values via CSS variables, dynamic transforms (rotation, opacity driven by JS state) |
| Custom CSS file | Complex effects: chiseled text shadows, icon keyframe animations, neon glow filters |

Each component that needs custom CSS has its own `.css` file alongside the `.tsx` (e.g., `NavBar.css`, `NavButton.css`, `ChisledText.css`).

## Key Components

- **`NavBar.tsx`** — owns dark mode state and tab state; uses Framer Motion layout animations for expand/collapse (spring: stiffness 1100, damping 60, mass 2)
- **`NavButton.tsx`** — icon swap animations with CSS keyframe sequences (sunrise/sunset metaphor for moon/sun)
- **`ChisledText.tsx`** — metallic 3D text effect via `background-clip`, `text-stroke`, and layered `text-shadow`
- **`Graffiti.tsx`** — dark-mode-only idle neon doodles; 30s idle timer; collision-detects against UI elements before placing SVGs
- **`MusicPlayer.tsx`** — album art spins via `requestAnimationFrame` (360° per 3s); hover reveals playback controls
- **`WorkExperience.tsx`** — cascading card reveal on hover with staggered opacity/transform transitions
