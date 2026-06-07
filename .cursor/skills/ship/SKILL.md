---
name: ship
description: End-to-end pre-push workflow for chrispyOS — frontend review, apply fixes, simplify, deslop, commit, and push to main. Use when the user says ship, /ship, just ship, ship it, or wants the fe-review → simplify → deslop → push sequence in one step.
argument-hint: "[--review-only | --no-push]"
---

# Ship

One-shot workflow that replaces running `/fe-review`, accepting fixes, `/simplify`, `/deslop`, and pushing separately.

Read and follow these project skills in order (do not skip steps):

1. [.cursor/skills/fe-review/SKILL.md](../fe-review/SKILL.md)
2. [.cursor/skills/simplify/SKILL.md](../simplify/SKILL.md)
3. [.cursor/skills/deslop/SKILL.md](../deslop/SKILL.md)

Also read [agents.md](../../../agents.md) before structural or styling edits.

---

## Arguments

| Argument | Behavior |
| -------- | -------- |
| *(none)* | Full workflow through push |
| `--review-only` | Stop after step 1 (review report only; no edits, no push) |
| `--no-push` | Run steps 1–6; commit locally but do not push |

---

## Workflow

Copy and track progress:

```
Ship progress:
- [ ] 1. Review pending changes (fe-review)
- [ ] 2. Apply review fixes
- [ ] 3. Simplify
- [ ] 4. Deslop
- [ ] 5. Lint & build
- [ ] 6. Commit
- [ ] 7. Push to main
```

### 1. Review (fe-review)

- Run pending-change mode: `git diff HEAD`, or `git diff main` if nothing is staged or modified vs HEAD.
- Scope: `.tsx`, `.ts`, `.js`, and `.css` files in the diff.
- Produce the fe-review output template (urgent first, then suggestions).
- If there are **no findings**, note that and continue to step 3.

If `--review-only`: **stop here**. Do not ask whether to apply fixes.

### 2. Apply review fixes

- **Auto-apply** all urgent and suggestion fixes from step 1. Do not ask for confirmation — that is the default for this skill.
- Skip findings that are false positives per fe-review rules.
- If a finding is ambiguous or would change behavior materially, apply the safest minimal fix and mention it in the final summary.

### 3. Simplify

- Follow the simplify skill on the session/branch diff (`git diff main` or uncommitted changes).
- Preserve exact behavior.

### 4. Deslop

- Follow the deslop skill on the same diff scope.
- Remove AI slop introduced on this branch or in the current session.

### 5. Lint & build

```bash
npm run lint
npm run build
```

Fix any failures before committing. Do not push broken code.

### 6. Commit

Only if there are changes to commit (`git status` shows modifications or untracked relevant files).

Follow the user's git safety protocol:

1. Parallel: `git status`, `git diff`, `git log -3 --oneline`
2. Stage relevant files (never `.env` or secrets)
3. Commit with a 1–2 sentence message focused on **why**, via HEREDOC
4. Verify with `git status`

If there is nothing to commit after steps 2–4, skip to step 7 only when the branch is ahead of remote with existing commits; otherwise report **nothing to ship**.

### 7. Push to main

Unless `--no-push`:

```bash
git push origin main
```

Confirm clean push or report errors. Never force-push to main.

---

## Final report

Keep it short (one short paragraph or a few bullets):

- Review: N urgent fixed, M suggestions fixed (or "no findings")
- Simplify / deslop: one line each if anything changed
- Commit: hash and message, or "nothing to commit"
- Push: pushed to `origin/main` or skipped reason

Do **not** append "Would you like me to apply the suggested fix(es)?" — this skill applies them automatically.
