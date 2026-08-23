# Agentic-AI Patterns

The reusable catalogue of agentic design patterns — generic engineering doctrine, ported via finwerse's own port of `smallTechOrg/zero-shot-claude-boilerplate` (pure reference catalogue, stack-agnostic). `spec/agent.md` records Dumpo's actual composition — its one LangGraph pipeline uses patterns #2, #3, and #5 below. Prefer the simplest pattern that works.

---

### 1. Prompt Chaining
**What** — Decompose a task into a fixed sequence of LLM steps.
**In Dumpo:** not really used — the router's output feeds deterministic Python logic (node routing), not a second LLM call in sequence, except for the journal-merge sub-call which is closer to pattern #5 (tool use) than chaining.

### 2. Routing
**What** — A classifier directs input to the right handler.
**In Dumpo:** the entire product's core mechanism — `router_node`'s LLM call classifies each atomic item's `action_type` and `primary_bucket`, then `route_from_router` fans out to the matching graph node(s).

### 3. Parallelization
**What** — Independent subtasks run concurrently.
**In Dumpo:** `get_live_user_memory`'s 6 bucket-snapshot queries run concurrently via `asyncio.gather`; the graph's conditional edges can fire `create_node`/`crud_node`/`chatbot_node` all in the same run when a dump is genuinely mixed-intent.

### 4. Reflection
**What** — The agent critiques and revises its own output.
**In Dumpo:** not used.

### 5. Tool Use (Function Calling)
**What** — The LLM calls external tools/APIs.
**In Dumpo:** not LLM-initiated function calling — the LLM's classification *decides* which deterministic Python functions (`write_to_bucket`, `_execute_crud`, `fuzzy_search_bucket`) the graph calls next; the LLM itself never issues a tool call directly (unlike finwerse's chatbot, which uses real Groq function-calling).

### 6. Planning
**In Dumpo:** not used — each dump is processed in one pass, no multi-step plan generated upfront.

### 7. Multi-Agent Collaboration
**In Dumpo:** not used at the product-runtime level. (As with finwerse: the `.claude/agents/*` sub-agents that build and maintain Dumpo *itself* are a development-tooling use of the term, unrelated to the product's own runtime behavior.)

### 8. Memory Management
**What** — Short-term (context window) and long-term (persisted) memory.
**In Dumpo:** both, and more thoroughly than finwerse's chatbot — `chat_messages` is genuine server-side persisted conversation history (finwerse's chatbot has none), and `get_live_user_memory` is a live, per-request "working memory" snapshot of the user's actual data specifically built to ground CRUD id-resolution.

### 9. Learning and Adaptation
**In Dumpo:** not used.

### 10. Model Context Protocol (MCP)
**In Dumpo:** not used — no MCP servers involved anywhere in the pipeline.

### 11. Goal Setting and Monitoring
**In Dumpo:** not used — every `/process` call is a single bounded pipeline run with a natural completion point.
