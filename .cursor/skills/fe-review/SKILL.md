---
name: fe-review
description: This skill should be used when the user asks to "review this diff", "review my frontend code", "fe review", "frontend review", "review these changes", or wants a senior frontend engineer perspective on React/TypeScript code. Triggers on: fe-review, frontend review, review diff, react review, senior review, code review frontend.
argument-hint: "[file path, or nothing for staged/working-tree changes]"
---

# Frontend Code Review

A senior frontend engineer's lens on React/TypeScript code — covering correctness, performance, and maintainability.

---

## Modes

**Pending-change review** (default, no argument): inspect staged and working-tree `.tsx`/`.ts`/`.js` files slated for commit. Use `git diff HEAD` to get the changeset; fall back to `git diff main` if HEAD has no staged changes.

**File-targeted review** (argument is a file path): review the named file(s) in full, not just a diff.

---

## Review Process

1. Open the relevant file(s). Read through the changed lines (or full file in file-targeted mode).
2. For each rule in the checklist, note deviations and capture a representative snippet.
3. Classify each finding:
   - **Urgent** — will cause a bug, crash, stale data, rule-of-hooks violation, or accessibility failure in practice
   - **Suggestion** — real improvement worth making, but won't break anything today
4. Compose output using the required template below. Urgent findings first, then suggestions.

---

## Checklist

### Code Quality

- **Rules of Hooks**: no hook calls inside conditionals, loops, or nested functions; no hooks after early returns; hooks only in components or custom `use*` functions
- **Keys**: no array index as `key` on lists that can reorder/filter/splice; no missing keys; no `Math.random()` or inline object keys
- **useEffect misuse**: no `useEffect` for logic that belongs in an event handler; no `useEffect` to derive state that could be `useMemo` or computed inline; no missing/incorrect dependency arrays; no missing cleanup for subscriptions, timers, or abort controllers
- **Stale closures**: event listeners and async callbacks must not capture stale state/props without a ref; no `ref.current` reads during render
- **TypeScript**: no `as` casts hiding real errors; no unwarranted `any`; no `!` on values that could genuinely be null/undefined; discriminated unions must be exhaustively handled

### Performance

- **Unstable references**: inline objects/arrays/functions as props to memoized children cause needless re-renders — hoist or memoize
- **Missing memoization**: expensive computations in render without `useMemo`
- **useCallback**: callbacks passed to memoized children should be stable via `useCallback`
- **Over-optimization**: `React.memo`/`useMemo`/`useCallback` without a real perf need is noise — flag it
- **Context churn**: object/array literals in `value={...}` re-create on every render, invalidating all consumers

### Correctness & Safety

- **Race conditions**: unguarded `setState` after `await` (component may have unmounted); missing abort signal on `fetch` in `useEffect`; unhandled promise rejections
- **Waterfall fetches**: sequential `await`s that could be `Promise.all`
- **Accessibility**: clickable `div`/`span` missing `role`, `tabIndex`, and keyboard handler; images missing `alt`; inputs missing `label`/`aria-label`; focus not restored after modal close
- **Security**: `dangerouslySetInnerHTML` with unsanitized user content; `eval` / `new Function` with dynamic strings

---

## Urgency Classification

| Classification | Criteria |
| -------------- | -------- |
| **Urgent** | Rule-of-hooks violation, stale closure causing wrong data, race condition, crash, a11y blocker, security issue |
| **Suggestion** | Performance improvement, missing memoization, waterfall fetch, over-optimization smell, TypeScript looseness that isn't causing bugs yet |

---

## False Positives — Do Not Flag

- Issues the TypeScript compiler or ESLint/CI would catch (type errors, missing imports, formatting)
- Pre-existing issues on lines **not touched** by the diff (pending-change mode only)
- Memoization concerns when the component is not a known perf hotspot
- Style preferences with no correctness or UX impact
- Patterns explicitly documented as intentional in a code comment

---

## Required Output

### Template A — findings exist

```
# Code review

Found <N> urgent issues that need to be fixed:

## 1 <brief description>
FilePath: <path> line <line>
<relevant code snippet>

### Suggested fix
<brief description of the fix>

---

... (repeat for each urgent issue) ...

Found <M> suggestions for improvement:

## 1 <brief description>
FilePath: <path> line <line>
<relevant code snippet>

### Suggested fix
<brief description of the fix>

---

... (repeat for each suggestion) ...
```

- If there are no urgent issues, omit that section entirely.
- If there are no suggestions, omit that section entirely.
- If findings exceed 10 in a section, summarize as "10+ urgent issues" / "10+ suggestions" and output only the first 10.
- Do not compress blank lines between sections — keep them as shown for readability.
- After the structured output, **if at least one finding requires a code change**, append: _"Would you like me to apply the suggested fix(es)?"_

### Template B — no findings

```
## Code review

No issues found.
```
