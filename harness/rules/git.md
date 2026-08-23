# Git Discipline

All git rules for every Claude Code session in this repo. Simpler than finwerse's model — Dumpo is solo work, confirmed with the user during this migration: commit and push directly to `main`, no staging branch, no separate reviewer.

---

## Branch Model

- **Commit and push directly to `main`.** No staging branch, no PR-gate — the user confirmed this is intentional for solo work.
- The repo has two stale `copilot/*` branches from prior GitHub Copilot usage (`copilot/conduct-code-audit`, `copilot/make-main-branch-default`) — leave them alone unless the user asks; don't assume they need cleanup as part of unrelated work.

## Commit + Push Are One Atomic Action

**Every commit must be pushed immediately.** `git commit -m "..." && git push origin main` is one indivisible action.

## Before Every Reply to the User

1. `git status`
2. If dirty: commit and push
3. Confirm the working tree is clean and `main` is pushed before replying

## Commit Message Format

Free-form, but always explain *why* — `context.md`'s existing changelog entries (dated, explains what broke and why, notes decisions made) are a genuinely good model for commit-message quality here, better than most.

## Staging Rules (git staging area, not a `staging` branch — Dumpo has none)

- **Never `git add -A` or `git add .`** — stage specific files or directories.
- Run `git diff --staged` before every commit.

## Commit Quality

- Commits are logical units — one self-contained change per commit.
- No commented-out code in commits.
- Never commit secrets — see `harness/rules/secret-hygiene.md`.
- Never force-push without explicit user confirmation.

## Closing a Session

- [ ] Working tree clean, committed and pushed to `main`
- [ ] `main` is up to date with `origin/main`
- [ ] Real verification (test run, or manual smoke check) happened before the push, not after
