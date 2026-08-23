# Architecture

## System Overview

Dumpo is an AI-powered mobile productivity app built around one idea: users dump raw, unstructured thoughts into a chat interface, and the AI automatically reads, formats, classifies, and files everything into structured buckets — no manual sorting, no folders, no save/delete buttons. "People do not organise. They dump. Dumpo organises automatically." (root `CLAUDE.md`).

## Component Map

```
app (Expo/React Native, iOS+Android+web via Expo)
  │  fetch, Authorization: Bearer <supabase JWT>
  ▼
backend (FastAPI, deployed on Render — https://dumpo.onrender.com)
  │
  ├──► Supabase Postgres (+ RLS, Realtime)  — system of record for every bucket
  ├──► Supabase Auth  — JWT issuance; app also calls Supabase directly for auth itself
  └──► Groq  — LLM classification (LangGraph pipeline), chat replies, Whisper transcription

index.html (repo root)  — a standalone static marketing/landing page, not part of either app or backend; not wired to anything above
```

Unlike finwerse's 3-surface split, Dumpo is a single product surface (`app`) talking to a single backend (`backend`) — there is no separate web dashboard; `app` itself can run in a browser via Expo's web target.

## Layers

| Layer | Responsibility |
|---|---|
| `app/src/screens`, `app/src/app` (Expo Router) | UI, navigation |
| `app/src/store` (Zustand: `authStore`, `chatStore`, `dashboardStore`) | Client-side state |
| `app/src/services/api.ts` | The only path to the backend — pulls a fresh Supabase JWT per request (`supabase.auth.getSession()`, relies on the SDK's `autoRefreshToken`), never calls Supabase directly for anything except auth (`app/CLAUDE.md`'s rule) |
| `backend/routers` | HTTP surface — request validation, auth, response shaping |
| `backend/services` | `graph_service` (the LangGraph pipeline), `llm_service` (Groq calls + validation), `bucket_service` (the per-table write logic), `supabase_service` (client factory) |
| Supabase Postgres | System of record, RLS-enforced (`spec/data.md`) |

## Data Flow

1. **Trigger:** user types or voice-dictates (`POST /api/v1/transcribe` first, if voice) a raw thought in the chat screen → `POST /api/v1/process`.
2. `graph_service.process_user_dump_graph` logs the raw user message to `chat_messages`, fetches a live snapshot of the user's active data (`get_live_user_memory`) and recent chat history, then runs the LangGraph pipeline (`spec/agent.md`).
3. The router node (Groq) classifies the dump into `journal_segment` and/or one or more `atomic_items`, each tagged CREATE/CRUD/CHAT.
4. Parallel downstream nodes execute: `create_node` writes new items via `bucket_service.write_to_bucket`; `crud_node` resolves and executes updates/deletes/reads/appends against existing items; `chatbot_node` answers anything conversational.
5. **Output:** every resulting item is logged back to `chat_messages` as an assistant reply (with `bucket_tags`, `confirmation_text`, etc.) and returned to the client in the `/process` response; the client renders the confirmation and (via `dashboardStore`/bucket screens) reflects the new/changed data.

Unlike finwerse (heavy precomputed batch job, light per-request reads), Dumpo has **no batch job at all** — every write happens synchronously inside the request that triggered it. There is no daily cron, no precomputation step; "no live computation" is not a rule here the way it is for finwerse, because there's nothing to precompute — classification is inherently a per-dump, real-time operation.

## External Dependencies

| Dependency | Purpose | Failure Mode |
|---|---|---|
| Supabase Postgres | System of record, RLS | Backend raises at import time if `SUPABASE_URL`/keys are unset (`pydantic-settings` required fields, no defaults) |
| Supabase Auth | JWT issuance + verification (`auth.get_user`) | `401` on any verification failure — no unverified-claims fallback (stricter than finwerse's chatbot auth, which does have a fallback path) |
| Groq | Router classification, chat replies, journal merge, Whisper transcription | Router/chatbot/merge all have a 2-retry-then-degrade pattern (`spec/agent.md`) — no request-level failure surfaced to the user for the classification path; `/transcribe` has no retry, a Groq failure there returns `500` directly |

## Stack

- **Language:** TypeScript (`app`), Python (`backend`, version not pinned via `.python-version` at repo root — confirm the actual version before assuming parity with finwerse's 3.12.2)
- **Agent framework:** LangGraph (`langgraph>=0.2.0`, `langchain-core>=0.2.0`) — a real graph, see `spec/agent.md`
- **LLM provider + model:** Groq — `openai/gpt-oss-20b` for classification/chat, `whisper-large-v3` for transcription
- **Backend:** FastAPI 0.110 + Uvicorn, no ORM (raw Supabase Python client calls, no SQLAlchemy) — a lighter-weight data-access layer than finwerse's
- **Database + auth:** Supabase Postgres + Auth, RLS-enforced
- **Frontend:** Expo (React Native) + TypeScript, Zustand, Expo Router
- **Dependency management:** `pip` + `requirements.txt` (backend, no `venv`/`uv` convention confirmed — check before assuming one), `npm` (frontend — `package-lock.json` present, no `bun`/`yarn` lockfile, unlike finwerse)
- **Deployment:** Render (backend, `RENDER_DEPLOY_HOOK` env var present in `config.py` — likely a deploy-trigger webhook rather than a `render.yaml` file, since none exists in the repo; confirm the actual deploy mechanism before relying on this), Expo EAS (mobile builds — `context.md` mentions `preview` and `production` OTA channels)

| Key library | Purpose |
|---|---|
| `fastapi`, `uvicorn` | Backend HTTP |
| `langgraph`, `langchain-core` | The dump-processing agent |
| `groq` | LLM client |
| `supabase` (Python) | DB + auth client |
| `pyjwt` | Present in requirements but not obviously used directly — `auth.py` verifies tokens via Supabase's own `auth.get_user`, not manual JWT decoding (unlike finwerse's `apps/api/auth.py`, which does decode manually). Confirm whether `pyjwt` is a leftover dependency before assuming it's load-bearing. |
| `pytest`, `httpx` | Backend test suite (`backend/tests/test_routers.py` — real and runnable, unlike finwerse's `apps/api`) |
| Expo, React Native, Zustand, `expo-secure-store` | Mobile app |

**Avoid:** hardcoding environment-specific values in `app/src/config.ts` the way `API_URL`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` currently are — no way to point a dev build at a local backend without editing source; a `harness/patterns/code.md` violation worth fixing, tracked in `spec/roadmap.md`.

## Deployment Model

Backend: long-running Render web service (confirmed via `app/src/config.ts`'s hardcoded `https://dumpo.onrender.com` and `config.py`'s `RENDER_DEPLOY_HOOK` setting — no `render.yaml` in the repo, so the service is likely configured directly in the Render dashboard rather than as code; worth creating one if reproducibility matters). Frontend: Expo-built mobile app shipped via EAS, with `preview` and `production` OTA update channels (per `context.md`'s 2026-08-14 entry, which explicitly re-targeted OTA updates from `main` to `preview` to hit the live channel — worth understanding this OTA-channel-vs-git-branch relationship before assuming "committed to `main`" alone ships anything to users).
