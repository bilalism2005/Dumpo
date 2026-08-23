# Agent

> Dumpo's entire product is built around one agentic pipeline: turning a raw thought dump into classified, structured, stored data. This is a **real LangGraph `StateGraph`** (`backend/services/graph_service.py`), unlike a hand-rolled sequence — required per the boilerplate convention this harness is based on ("mandatory for any project using LangGraph... an incomplete graph while a framework is in use is a CRITICAL BLOCKER").

---

## Agent Architecture Pattern

**Chosen: Router + parallel conditional fan-out (Graph/LangGraph).** One router node classifies and splits the input, then conditionally routes to up to three downstream node types in the same graph run — not mutually exclusive, a single dump can hit all three at once (e.g. "Had a rough day. Also mark the gym task done and remind me to call mom" → journal segment + CRUD + CREATE, all in one `/process` call). Maps to `harness/patterns/agentic-ai.md` patterns #2 (Routing), #3 (Parallelization — multiple destinations fire from one conditional edge), #5 (Tool Use — Supabase reads/writes and the Groq LLM calls are the tools).

## LLM Provider & Model

| Node | Provider | Model ID | Rationale |
|---|---|---|---|
| `router_node` (via `router_node_llm`) | Groq | `openai/gpt-oss-20b` | Migrated 2026-08-16 from `llama-3.1-8b-instant` following Groq's deprecation notice (`context.md`) — confirmed live in `llm_service.py` |
| `chatbot_node` | Groq | same, `MODEL_NAME` constant shared across both call sites | `temperature=0.7` for conversational replies vs. `0.1` for the router's classification call |
| `merge_journals_narrative` (called from `crud_node`'s APPEND path and `bucket_service.write_to_bucket`'s same-day journal merge) | Groq | same | `temperature=0.4`, explicit system prompt forbidding hallucination/embellishment — "MAKE MINIMAL EDITS" |
| `/api/v1/transcribe` (not part of the graph, but same LLM provider) | Groq | `whisper-large-v3` | Voice-to-text ahead of `/process` |

**Fallback behaviour:** the router LLM call retries up to 2 times with a 1s backoff on any exception; if both attempts fail, it returns a **hard-coded fallback response** — `action_type: CREATE`, `primary_bucket: others`, raw text preserved — rather than surfacing an error to the user. This means an LLM outage degrades to "everything lands in Others," not a failed request. `merge_journals_narrative` degrades similarly: on failure, it just concatenates old + new content instead of a clean merge.

**Prompt strategy:** single system + user prompt per call (no few-shot examples in-prompt); `response_format={"type": "json_object"}` forces JSON mode on the router call; the system prompt additionally instructs "No markdown formatting... no chat prose" as a belt-and-suspenders measure (`harness/rules/ai-agents.md`'s equivalent to finwerse's Groq-JSON rule). The router prompt wraps the raw user text in `<user_input>` tags with an explicit instruction to treat it as data, not instructions to follow — a prompt-injection guard, same pattern finwerse's chatbot uses for its `<RAW_DATA>` tags.

## Tools & Tool Calling

Not LLM-initiated function calling — this graph's "tools" are deterministic Python functions the graph nodes call directly, with the LLM only producing the *classification* that decides which functions run.

| Tool | Description | Inputs | Output | On Failure |
|---|---|---|---|---|
| `get_live_user_memory` | Fetches a capped snapshot of the user's active data across all buckets (30 tasks, 25 unwatched watchlist, 20 ideas, 15 unsettled finance, 9 health, today's journal) so the router LLM can resolve CRUD targets by id | `user_id`, `today` | dict keyed by bucket | Returns `{}` on failure — router proceeds with no memory context, meaning CRUD id-resolution silently degrades to fuzzy search |
| `write_to_bucket` (`bucket_service.py`) | Inserts (or same-day-merges, for journals) a classified item into its target table | `user_id`, `dump_id`, `bucket`, `secondary_buckets`, `extracted_data` | the inserted/updated row | Falls back to writing the raw payload into `others` on any exception — **this is the mechanism behind the finance/watchlist bug tracked in `spec/roadmap.md`** |
| `_execute_crud` | Executes a resolved CRUD operation (UPDATE/DELETE/APPEND/READ) against a specific record id | `bucket`, `operation`, `record_id`, `update_fields`, `text` | a `ProcessResponseItem`-shaped dict | Returns a "something went wrong" confirmation item rather than raising |
| `fuzzy_search_bucket` | ILIKE fallback when the LLM couldn't resolve a CRUD target's id from memory context | `user_id`, `bucket`, `query` | list of candidate rows | Returns `[]` on failure — surfaced to the user as "I couldn't find anything matching..." |
| `normalize_update_fields` | Maps LLM alias keys (`status: "done"`, `is_done: true`, etc.) to exact column names per bucket | `bucket`, raw update dict | normalized dict | Falls through to the raw dict unchanged if the bucket isn't one of the 5 handled — no normalization for `others`/`journals` update fields beyond what's explicitly listed |

## Agent State

```python
class AgentState(TypedDict):
    raw_input: str
    user_id: str
    message_id: str
    current_time_context: Optional[str]
    chat_history: List[Dict[str, Any]]
    live_memory: Dict[str, Any]

    # Router Outputs
    dump_type: str                    # "narrative" | "atomic" | "mixed"
    journal_segment: Optional[str]
    atomic_items: List[Dict[str, Any]]

    # Output Aggregators — operator.add means each parallel node's list APPENDS
    # rather than overwrites, so create_node + crud_node + chatbot_node can all
    # contribute to the same final `items` list in one graph run.
    response_messages: Annotated[List[str], operator.add]
    bucket_tags: Annotated[List[str], operator.add]
    items: Annotated[List[Dict[str, Any]], operator.add]
```

## Nodes / Steps

### `router_node`
**Reads from state:** `raw_input`, `user_id`, `current_time_context`.
**Writes to state:** `dump_type`, `journal_segment`, `atomic_items`, `live_memory`, `chat_history`.
**LLM call:** yes — `router_node_llm` (Groq, JSON mode, temp 0.1). Fetches live memory + last 10 chat turns first, to ground the classification.
**Behaviour:** Formats/fixes grammar, translates Hinglish, splits the dump into atomic items, classifies `dump_type`, and for each atomic item decides `action_type` (CREATE / CRUD / CHAT) and — for CREATE/CRUD — the target `primary_bucket`. For CRUD, additionally resolves `resolved_id` from memory context (discarding any id the LLM hallucinated that doesn't actually appear in the memory context — `validate_crud_fields`) and whitelists `update_fields` to real columns per bucket.

### `create_node`
**Reads from state:** `journal_segment`, `atomic_items` (filtered to `action_type == "CREATE"`).
**Writes to state:** `items` (appended).
**LLM call:** no (delegates to `write_to_bucket`, which may itself call the LLM for journal same-day merges).
**Behaviour:** Writes the journal segment (if any) and every CREATE item to its bucket table, building a user-facing confirmation string per item (`"'<title>' saved to <Bucket>."` plus a reminder line if applicable).

### `crud_node`
**Reads from state:** `atomic_items` (filtered to `action_type == "CRUD"`).
**Writes to state:** `items` (appended).
**LLM call:** only indirectly, via `_execute_crud`'s APPEND path calling `merge_journals_narrative`.
**Behaviour:** Three resolution paths per item, in order: (1) `operation == READ` with no id → direct table query, formats a readable list; (2) `resolved_id` present → fast path straight to `_execute_crud`; (3) no id → `fuzzy_search_bucket` ILIKE fallback, which itself branches on 0 matches (not-found message) / 1 match (execute) / 2+ matches (ask the user to disambiguate — same pattern as finwerse's chatbot symbol disambiguation).

### `chatbot_node`
**Reads from state:** `atomic_items` (filtered to `action_type == "CHAT"`), `chat_history`.
**Writes to state:** `items` (appended).
**LLM call:** yes — general conversational reply, `CHATBOT_SYSTEM_PROMPT` ("You are Dumpo... a warm, intelligent, and helpful AI assistant"), temp 0.7, full recent chat history as context.
**Behaviour:** For general-knowledge or conversational items that aren't tied to the user's stored data.

### `output_compiler_node`
**Reads from state:** nothing new.
**Writes to state:** nothing (`return {}`) — a no-op terminal node.
**Behaviour:** Exists purely as a single convergence point so all three parallel branches (`create_node`/`crud_node`/`chatbot_node`) have one common edge to `END`, rather than three separate edges to `END`. Purely structural.

## Graph / Flow Topology

```
START
  │
  ▼
router_node
  │
  ├──(journal_segment present)────────────► create_node ─┐
  ├──(any atomic_item.action_type=CREATE)──► create_node ─┤
  ├──(any atomic_item.action_type=CRUD)────► crud_node ────┼──► output_compiler_node ──► END
  └──(any atomic_item.action_type=CHAT)────► chatbot_node ─┘
     (none of the above → defaults to create_node)
```

**Conditional edges:** a single function, `route_from_router`, returns a **list** of destination node names (LangGraph fans out to all of them in parallel when a conditional-edge function returns multiple targets) — not a single branch choice. This is the mechanism behind "one dump can create a task AND answer a question AND update an existing item, all in the same `/process` call."

| Source | Condition | Targets |
|---|---|---|
| `router_node` | `journal_segment` truthy, or any item is CREATE | `create_node` |
| `router_node` | any item is CRUD | `crud_node` |
| `router_node` | any item is CHAT | `chatbot_node` |
| `router_node` | none of the above (empty/failed classification) | `create_node` (default) |

## Memory & Context

| Scope | Mechanism | What is stored |
|---|---|---|
| Within a run | LangGraph `AgentState` | All in-progress data for one `/process` call |
| Across runs | `chat_messages` table (Postgres) | Full conversation history — user dumps and assistant replies, both persisted server-side (unlike finwerse's chatbot, which has no server-side history at all) |
| "Live memory" for CRUD grounding | Direct DB query at the start of each `router_node` run (`get_live_user_memory`) | A capped, per-bucket snapshot (see Tools table) — re-fetched fresh every request, not cached across requests |
| Conversation | `chat_history` — last 10 turns fetched by `router_node`, capped further to last 5 inside `router_node_llm`'s prompt, and separately re-fetched/reused for `chatbot_node` | |

**Context window management:** hard caps by count (10 turns fetched, 5 used in the router prompt) and by character length (`text` truncated at 1500 chars, `chat_context` at 2000 chars, journal merge inputs at 600 chars each) — not token-counted, not summarized.

## Human-in-the-Loop Checkpoints

One implicit checkpoint: when `fuzzy_search_bucket` returns 2+ candidates for a CRUD target, the graph run ends with a disambiguation question rather than guessing — the user's next `/process` call (their answer) is a fresh graph run, not a resumed one (no LangGraph checkpointing is configured).

## Error Handling & Recovery

**Node-level:** every node wraps its DB/LLM calls in try/except; failures degrade to a placeholder confirmation string rather than raising, with one exception — `_execute_crud`'s outer function still lets the router's classification-level exceptions propagate to `chat.py`'s route handler, which converts them to a `500` with the exception message.

**Graph-level:** no `handle_error` node, no persisted run-status row — same shape as finwerse's chatbot, and for the same reason: there's no long-running "run" record to mark failed, each `/process` call is a bounded, synchronous pipeline.

**Resume/retry:** none — a failed or unsatisfying result is just a new `/process` call from the client.

**Partial failure:** the design goal throughout mirrors finwerse's chatbot — one bucket write failing (or one CRUD item failing) never blocks the others in the same dump; `write_to_bucket`'s catch-all fallback-to-`others` is *itself* the partial-failure story, though see `spec/roadmap.md`'s Known Gaps for where that fallback is currently masking a real bug rather than genuinely saving the day.

## Observability

| Signal | What | Where |
|---|---|---|
| Node-level failures | `logger.error`/`logger.warning` at every catch site | Python `logging` → stdout |
| No structured tracing | No LangSmith / OpenTelemetry / per-request trace id | — |

Same gap as finwerse's chatbot: no structured request/response logging (input summary, output summary, latency) and no trace id propagation across the graph's nodes. Worth flagging as a candidate improvement, not fixed as part of this migration.

## Concurrency Model

- **Run isolation:** none needed — stateless per-request, no shared run record.
- **Parallel work within a run:** the conditional fan-out itself (`create_node`/`crud_node`/`chatbot_node` can all execute in the same graph run when the router produces mixed action types); within `get_live_user_memory`, all 6 bucket-snapshot queries run concurrently via `asyncio.gather`.
- **Checkpointing:** none configured (`workflow.compile()` with no checkpointer) — a mid-graph failure doesn't resume, it just fails that request.

## Graph Assembly

```python
workflow = StateGraph(AgentState)
workflow.add_node("router_node",          router_node)
workflow.add_node("create_node",          create_node)
workflow.add_node("crud_node",            crud_node)
workflow.add_node("chatbot_node",         chatbot_node)
workflow.add_node("output_compiler_node", output_compiler_node)

workflow.set_entry_point("router_node")
workflow.add_conditional_edges("router_node", route_from_router, {
    "create_node":  "create_node",
    "crud_node":    "crud_node",
    "chatbot_node": "chatbot_node"
})
workflow.add_edge("create_node",          "output_compiler_node")
workflow.add_edge("crud_node",            "output_compiler_node")
workflow.add_edge("chatbot_node",         "output_compiler_node")
workflow.add_edge("output_compiler_node", END)

dumpo_graph = workflow.compile()
```

This is the real, current assembly in `backend/services/graph_service.py` (lines ~570-589) — reproduced here rather than paraphrased, since the whole point of this file is to stay checkable against it.
