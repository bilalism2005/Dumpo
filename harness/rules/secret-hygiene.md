# Rule: Secret Hygiene

**Scope:** everywhere, always.

## What is a secret

Anything that authenticates, authorizes, or can impersonate. For Dumpo specifically: `GROQ_API_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET` (if ever added — not currently used, see `spec/architecture.md`'s note on `pyjwt` being present but not obviously load-bearing), `RENDER_DEPLOY_HOOK`.

## The Supabase anon-key exception

`app/src/config.ts` hardcodes `SUPABASE_ANON_KEY` directly in committed source. **This is expected, not a violation** — Supabase's anon key is designed to be public in client code; the actual security boundary is Row Level Security on the database (`spec/data.md`), not key secrecy. Don't flag this as a finding, and don't "fix" it by moving it to an env var out of habit — that would just relocate a value that was never meant to be secret in the first place. The real gap in that same file is `API_URL` being hardcoded (a code-quality issue, not a secret-hygiene one — see `harness/patterns/tech-stack.md`).

## Where secrets live

| Location | Secrets allowed? |
|---|---|
| root `.env` (backend reads this, `backend/config.py`) | ✅ Yes |
| OS / Render environment variables | ✅ Yes |
| Source code | ❌ Never (except the anon-key exception above) |
| Git history | ❌ Never |
| Commit messages, PR descriptions, logs | ❌ Never |

## Rules for code

**Never log a secret.** `backend/CLAUDE.md` already states this ("Never commit secrets: keep all credentials in the root `.env` file") — this file extends it to logging specifically, which the existing rule didn't spell out.

**Never include secrets in exception messages.**

## Rules for commits

Before every commit: scan the diff for token-shaped strings (length >20, mixed alphanumeric, provider-specific prefixes — Groq keys, Supabase service-role JWTs). If found and it's a genuine secret (not the anon key), stop, don't commit, rotate if it was real.

## Rules for AI agents

- Load keys programmatically from `.env`/environment; confirm presence by boolean only, never echo the value.
- Never commit a file containing a real secret, even if asked — push back, rotate, continue.
- When a new secret is needed, tell the user to add it to root `.env` and the Render dashboard's env vars — never accept one pasted into chat or committed.

## If a secret leaks

1. Rotate at the provider immediately.
2. Update `.env` and Render's env var with the new value.
3. Purge from git history if committed (`git filter-repo`/`bfg`) — force-push only with explicit user approval.
4. Note the incident in the commit message without repeating the leaked value.
