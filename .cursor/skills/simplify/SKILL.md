---
name: simplify
description: Simplify and refine recently modified code for clarity and consistency. Use after writing code to improve readability without changing functionality. Triggers on: simplify, refine code, clean up code, improve readability.
---

# Simplify Code

Refine recently modified code for clarity and consistency while preserving exact behavior.

---

## Principles

1. **Preserve functionality** — never change outputs, side effects, or user-visible behavior.

2. **Follow project standards** — read [agents.md](agents.md) and match surrounding file conventions (Next.js App Router, `"use client"` where needed, CSS variables for theming, Tailwind + inline styles + sibling `.css` for effects).

3. **Enhance clarity**
   - Reduce unnecessary nesting and redundant abstractions
   - Consolidate duplicate logic
   - Prefer clear names over clever one-liners
   - Avoid nested ternaries; use `if`/`else` or early returns
   - Remove comments that restate obvious code

4. **Avoid over-simplification**
   - Do not merge unrelated concerns
   - Do not remove abstractions that aid organization
   - Do not optimize for line count over readability

5. **Scope** — only touch code modified in the current branch or session unless asked for more.

---

## Process

1. Identify recently changed sections (`git diff main` or session edits).
2. Look for duplication, verbose comments, defensive patterns inconsistent with the file, and unnecessary `useCallback`/`useMemo`.
3. Apply refinements that match existing patterns in the same component or module.
4. Run `npm run lint` (and `npm run build` if the change is non-trivial).

---

## Output

After applying changes, report in **1–3 sentences** what you simplified and why — no long changelog.
