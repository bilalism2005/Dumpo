# Spec — Single Source of Truth

This directory is the authoritative specification for Dumpo. All code must match this spec. When spec and code disagree, **spec wins — fix the code**, per `harness/patterns/spec-driven.md`.

## Origin

This `spec/` was created 2026-08-16 (adapting the structure from `smallTechOrg/zero-shot-claude-boilerplate`, which finwerse's own `spec/`/`harness/` were also ported from). Unlike finwerse, there was no PRD/TRD to migrate — Dumpo's original root/`app`/`backend` `CLAUDE.md` files (kept in place, see `CLAUDE.md`'s note) and `context.md`'s changelog were the only prior documentation. `data.md`, `api.md`, and `agent.md` were derived by reading `backend/schema.sql`, all 4 routers, and `backend/services/graph_service.py`/`llm_service.py`/`bucket_service.py` directly.

That direct-code read surfaced a real, high-severity bug (Finance and Watchlist item creation silently misfiring into the `others` bucket, caused by dead-column references left over from a schema simplification) — see `spec/roadmap.md` → Known Gaps. Recording real divergences like this, rather than writing an idealized spec, is the point.

## Structure

```
spec/
  roadmap.md       ← what Dumpo does, standing design rules, build status, known gaps
  architecture.md  ← system design, data flow, the chosen ## Stack
  agent.md         ← the LangGraph dump-classification pipeline (Dumpo's core, not a side feature)
  data.md          ← the 10-table schema
  api.md           ← the REST surface
  ui.md            ← the app's screens
  capabilities/    ← one file per capability (7 files)

harness/
  rules/           ← ai-agents, git, secret-hygiene
  patterns/        ← engineering-practices, test-driven, ui-ux, agentic-ai (ported as-is from finwerse's
                     own port of the boilerplate); spec-driven, tech-stack, code (Dumpo-specific)
```

## Governance Rules

1. **Spec first** — no code change without a spec backing it
2. **One fact, one place** — cross-reference with links, never restate
3. **Capabilities are atomic** — each `capabilities/*.md` describes one discrete thing
4. **No implementation details in product spec** — `spec/` is WHAT, `harness/` is HOW
5. **Update spec before code**

## Who Updates the Spec

- **New capability:** once ported, run `/zero-shot-build`
- **Drift between spec and code:** once ported, run `/zero-shot-sync` (spec wins, except where spec itself is wrong — surfaced, never silently rewritten)
