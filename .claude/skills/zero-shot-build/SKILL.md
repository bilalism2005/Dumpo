---
name: zero-shot-build
description: Turn an idea for a new Dumpo capability (or a substantial change to an existing one) into a spec'd, implemented, tested addition. One intake round to pin down the design, then spec-writer updates spec/, then the build runs across whichever surfaces (app / backend) the capability touches, gated by qa-auditor. For a single-surface, well-scoped change, skip straight to spec-writer + code-generator directly instead of this skill.
argument-hint: [your idea, or the capability/change to make]
allowed-tools: Bash(git*)
---

**Auto-invocation policy:** invoke this skill on your own analysis whenever the user describes a new capability or a substantial change — they don't need to type `/zero-shot-build` explicitly. When auto-invoking, `$ARGUMENTS` is the user's own request, not your elaboration of it.

You run intake for a new (or substantially changed) Dumpo capability, then hand off to `spec-writer` and the build. The idea is in `$ARGUMENTS`. **If `$ARGUMENTS` is empty (invoked with no context at all), ask the user in plain text to describe the idea, and WAIT for their reply.** Do NOT use `AskUserQuestion` to solicit or invent the idea itself.

Dumpo already exists — intake here is about pinning down *this specific addition* against an established product and its 5 Standing Design Rules, not choosing a tech stack from scratch.

## Stage 1 — Intake

Use `AskUserQuestion` to resolve anything that would force `spec-writer` to guess:
- What exactly does this capability do, for whom, and why?
- Which surface(s) — `app`, `backend`, or both?
- Does it need a new/changed Supabase column? **If yes, explicitly plan the full set of code paths that reference it** — this codebase has a live example (Finance/Watchlist) of what happens when a schema change doesn't get matched everywhere.
- **Standing Design Rules check:** does this need a save or delete button (both forbidden — the product's core interaction model depends on autosave + clear-to-delete)? Does it need to call Supabase directly from the client (forbidden except the existing auth exception)? Are all new tappable elements ≥48px? Is the interaction fast enough for the <400ms/optimistic-UI rule, or does it need explicit progress feedback if genuinely slower?

## Stage 2 — Design

Invoke `spec-writer` with the intake brief. It creates/updates the relevant `spec/capabilities/*.md` plus whichever of `data.md`/`api.md`/`ui.md`/`agent.md`/`architecture.md`/`roadmap.md` the capability affects, self-reviews, returns. Read what it wrote before proceeding.

## Stage 3 — Build

- **Single surface:** invoke `code-generator` directly, then `qa-auditor` to gate.
- **Both surfaces:** invoke `agent-builder` to orchestrate — parallel `code-generator` per surface, gated independently.

For a large addition, prefer staged delivery (e.g. backend first, app UI second) with a check-in between stages.

## Stage 4 — Verify + report

Once VERIFIED, report: what was built, on which surface(s), how to test it (the real run command per surface), and any known limitation. If ready to ship, it's already on `main` per the confirmed workflow — no PR step for this repo.

## Failure modes to avoid

- Skipping intake on something genuinely ambiguous, especially the Standing Design Rules check.
- Re-choosing Dumpo's stack instead of building within it.
- Introducing a schema change without checking every code path that references the old shape.
- Silently proposing an exception to a Standing Design Rule.
