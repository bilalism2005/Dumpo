# Engineering Best Practices

Rules that apply to every implementation task in this repo, regardless of surface (`app`, `backend`). Ported from `smallTechOrg/zero-shot-claude-boilerplate` via finwerse's own port of it — stack-agnostic doctrine, Dumpo-specific examples substituted in.

---

## Design

**Single responsibility.** Every function, class, and module does one thing.

**Dependency inversion.** Code depends on abstractions, not concrete implementations — makes testing and future swaps cheap.

**No premature abstraction.** Three similar lines beats a premature helper. Extract only at three real uses.

**Immutable data by default.** Prefer returning new values over mutating in place.

---

## Testing

**Tests are part of the change — not an afterthought.**

**Testing pyramid.** Unit at the base, integration above (real DB, real LLM boundary), E2E/smoke fewest and at the top.

**Test behaviour, not implementation.**

**Never mock what you can stub.** The LLM/external provider is **not** stubbed in integration/e2e tests — those hit the real Groq API with real keys.

**One assertion per concept.**

**Unit tests must be deterministic** — no wall clock, no unseeded randomness. Integration/e2e tests do make real calls; assert structural properties, not exact prose.

---

## Code quality

**Name things from the caller's perspective.**

**Short functions.**

**No magic numbers or strings.** Every hard-coded literal with domain meaning gets a named constant — e.g. Dumpo's 500ms autosave debounce, the 48px minimum tap target, the ≥0.6 CRUD-confidence threshold before allowing a destructive operation.

**Fail fast.** Validate at the boundary (API request, form input).

**Return early.**

---

## Error handling

**Handle errors at the level that has context to recover.**

**Distinguish recoverable from unrecoverable.** Note: `backend/CLAUDE.md`'s existing rule ("Try/Catch Everywhere... default/fallback behaviors must be executed") pushes Dumpo's backend toward *always* recovering rather than ever failing hard — this is a deliberate product choice (a broken LLM call should never crash a user's dump), but it comes with a real cost: see `spec/roadmap.md`'s Known Gaps for a case where "always recover" silently masked a real bug (the Finance/Watchlist dead-column issue) instead of surfacing it. When extending this pattern, prefer a **loud fallback** (log clearly, and where possible surface a distinguishable status to the caller) over a **silent** one.

**Log at the right level.** Never log a token, JWT, or Groq API key.

**Errors must include context.** `"Failed to write to finance"` is weak. `"Failed to write to finance for user_id=... : column 'category' does not exist"` is actionable — and would have caught the known bug immediately if this level of detail had been in the log line to begin with.

---

## Security

**Never trust input.** Validate everything crossing a trust boundary.

**Principle of least privilege.** Note Dumpo already does this well at the DB layer — RLS on every table means even a query bug can't leak cross-user data, a stronger guarantee than app-level-only scoping.

**Secrets are never in code.** See `harness/rules/secret-hygiene.md` — note the nuance there about Supabase anon keys being an expected exception, not a violation.

**Parameterised queries only.** The Supabase Python client's query builder (`.eq()`, `.ilike()`, etc.) already parameterizes — never construct a raw SQL string with interpolated user input.

**Dependency hygiene.** Pin versions (already done in `backend/requirements.txt`).

---

## Observability

**Structured logging.** Currently plain-text `logging` module calls throughout `backend/` — no structured/JSON logging, no trace id. Flagged as a gap in `spec/agent.md`, not fixed here.

**Every external call is instrumented where it matters.** Groq call latency/failure rate and the LangGraph pipeline's per-node timing would be the highest-value additions given how much of the product's correctness depends on that one pipeline.

---

## Git and code review

See `harness/rules/git.md` (direct-to-`main` workflow — simpler than finwerse's staging model, same rigor).

**Commits are logical units.**

**Commit messages explain the why** — `context.md`'s existing changelog entries are actually a good model for this (they consistently explain what broke, why, and what changed).

**No commented-out code in commits.**

**Review the diff before committing.** `git diff --staged` before every commit.
