import logging
import json
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import asyncio
import operator
from langgraph.graph import StateGraph, END
from langgraph.store.memory import InMemoryStore
from backend.services.llm_service import router_node_llm, client, MODEL_NAME, merge_journals_narrative
from backend.services.bucket_service import write_to_bucket
from backend.services.supabase_service import get_supabase_client
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)
supabase = get_supabase_client()

# ─── AgentState ──────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    raw_input: str
    user_id: str
    message_id: str
    current_time_context: Optional[str]
    chat_history: List[Dict[str, Any]]

    # Router Outputs
    dump_type: str
    journal_segment: Optional[str]
    atomic_items: List[Dict[str, Any]]

    # Output Aggregators (operator.add = append across parallel nodes)
    response_messages: Annotated[List[str], operator.add]
    bucket_tags: Annotated[List[str], operator.add]
    items: Annotated[List[Dict[str, Any]], operator.add]
    success: bool

# ─── LangGraph InMemoryStore ──────────────────────────────────────────────────
memory_store = InMemoryStore()

BUCKET_TABLE_MAP = {
    "tasks":     "tasks",
    "ideas":     "ideas",
    "watchlist": "watchlist",
    "finance":   "finance",
    "health":    "health",
    "journals":  "journals",
}


def sync_user_memory(user_id: str, today: str):
    """
    Sync a compressed snapshot of the user's active data across ALL buckets into
    LangGraph InMemoryStore so the Router LLM can resolve CRUD entity IDs.

    Caps (total ~100 items, ~1300 tokens max):
      tasks     → 30  (active/incomplete only)
      watchlist → 25  (unwatched only)
      ideas     → 20
      finance   → 15  (unsettled only)
      health    → 9
      journals  → 1   (today's entry only, if exists)
    """
    try:
        tasks_res = supabase.table("tasks")\
            .select("id, title, due_date")\
            .eq("user_id", user_id)\
            .eq("is_complete", False)\
            .order("created_at", desc=True)\
            .limit(30).execute()

        watchlist_res = supabase.table("watchlist")\
            .select("id, title, is_watched")\
            .eq("user_id", user_id)\
            .eq("is_watched", False)\
            .order("created_at", desc=True)\
            .limit(25).execute()

        ideas_res = supabase.table("ideas")\
            .select("id, title")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(20).execute()

        finance_res = supabase.table("finance")\
            .select("id, description, is_settled, amount, currency")\
            .eq("user_id", user_id)\
            .eq("is_settled", False)\
            .order("created_at", desc=True)\
            .limit(15).execute()

        health_res = supabase.table("health")\
            .select("id, title")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(9).execute()

        # Journals — today's entry ONLY (max 1)
        journal_res = supabase.table("journals")\
            .select("id, journal_date, title")\
            .eq("user_id", user_id)\
            .eq("journal_date", today)\
            .limit(1).execute()

        memories = {
            "tasks":     tasks_res.data or [],
            "watchlist": watchlist_res.data or [],
            "ideas":     ideas_res.data or [],
            "finance":   finance_res.data or [],
            "health":    health_res.data or [],
            "journals":  journal_res.data or [],
        }

        memory_store.put(("memories", user_id), "user_data", memories)
        logger.info(
            f"Memory synced for {user_id}: "
            f"tasks={len(memories['tasks'])}, watchlist={len(memories['watchlist'])}, "
            f"ideas={len(memories['ideas'])}, finance={len(memories['finance'])}, "
            f"health={len(memories['health'])}, journals={len(memories['journals'])}"
        )
    except Exception as e:
        logger.error(f"Error syncing user memory: {e}")


def normalize_update_fields(bucket: str, update_fields: Dict[str, Any]) -> Dict[str, Any]:
    """Safely map LLM alias keys (e.g. status='done', is_done=True) to exact Supabase table column names."""
    if not isinstance(update_fields, dict):
        return {}
    
    normalized = {}
    
    if bucket == "tasks":
        for key, val in list(update_fields.items()):
            key_lower = str(key).lower()
            if key_lower in ["is_complete", "is_done", "done", "completed", "status", "complete"]:
                if val in [True, "done", "complete", "completed", "true", 1]:
                    normalized["is_complete"] = True
                    normalized["completed_at"] = datetime.now(timezone.utc).isoformat()
                elif val in [False, "pending", "incomplete", "false", 0]:
                    normalized["is_complete"] = False
                    normalized["completed_at"] = None
            elif key_lower in ["title", "due_date", "due_time", "reminder_set"]:
                normalized[key_lower] = val

    elif bucket == "watchlist":
        for key, val in list(update_fields.items()):
            key_lower = str(key).lower()
            if key_lower in ["is_watched", "watched", "status"]:
                if val in [True, "watched", "true", 1]:
                    normalized["is_watched"] = True
                    normalized["watched_at"] = datetime.now(timezone.utc).isoformat()
                elif val in [False, "unwatched", "false", 0]:
                    normalized["is_watched"] = False
                    normalized["watched_at"] = None
            elif key_lower in ["title", "genre", "content_type", "platform", "language", "year_of_launch"]:
                normalized[key_lower] = val

    elif bucket == "finance":
        for key, val in list(update_fields.items()):
            key_lower = str(key).lower()
            if key_lower in ["is_settled", "settled", "status"]:
                if val in [True, "settled", "paid", "true", 1]:
                    normalized["is_settled"] = True
                    normalized["settled_at"] = datetime.now(timezone.utc).isoformat()
                elif val in [False, "unsettled", "pending", "false", 0]:
                    normalized["is_settled"] = False
                    normalized["settled_at"] = None
            elif key_lower in ["description", "amount", "currency", "category"]:
                normalized[key_lower] = val

    elif bucket == "ideas":
        for key, val in list(update_fields.items()):
            key_lower = str(key).lower()
            if key_lower in ["title", "description"]:
                normalized[key_lower] = val

    elif bucket == "health":
        for key, val in list(update_fields.items()):
            key_lower = str(key).lower()
            if key_lower in ["title", "description", "health_type"]:
                normalized[key_lower] = val

    return normalized if normalized else update_fields


# ─── Fuzzy Search Fallback ────────────────────────────────────────────────────
def fuzzy_search_bucket(user_id: str, bucket: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    ILIKE fallback search when resolved_id is null.
    Strips action stop words ("mark", "done", "delete") to find the true item title.
    """
    table = BUCKET_TABLE_MAP.get(bucket)
    if not table:
        return []

    title_col = "description" if bucket == "finance" else "title"
    try:
        stop_words = {"mark", "as", "done", "complete", "completed", "delete", "remove", "cancel", "update", "change", "the", "my", "to", "task", "idea", "item"}
        words = [w for w in query.strip().split() if w.lower() not in stop_words]
        keyword = words[0] if words else (query.strip().split()[-1] if query.strip() else query)
        res = supabase.table(table)\
            .select(f"id, {title_col}")\
            .eq("user_id", user_id)\
            .ilike(title_col, f"%{keyword}%")\
            .limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Fuzzy search failed for {bucket}: {e}")
        return []


# ─── Helper ───────────────────────────────────────────────────────────────────
def _bucket_tag(bucket: str) -> str:
    icons = {
        "tasks": "✅ Tasks", "ideas": "💡 Ideas", "journals": "📓 Journal",
        "finance": "💰 Finance", "health": "❤️ Health",
        "watchlist": "🎬 Watchlist", "others": "📦 Others", "chat": "💬 Chat"
    }
    return icons.get(bucket, f"📦 {bucket.capitalize()}")


# ─── NODES ────────────────────────────────────────────────────────────────────
async def router_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]

    try:
        today = state["current_time_context"].split("T")[0]
    except Exception:
        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()

    sync_user_memory(user_id, today)

    stored_memories = memory_store.get(("memories", user_id), "user_data")
    memory_context = ""
    if stored_memories and stored_memories.value:
        memory_context = json.dumps(stored_memories.value, ensure_ascii=False)

    # Fetch recent conversation history (last 10 turns) to give Router context
    recent_history = []
    try:
        loop = asyncio.get_running_loop()
        history_res = await loop.run_in_executor(None, lambda:
            supabase.table("chat_messages")
                .select("role, content")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(10).execute()
        )
        if history_res.data:
            recent_history = list(reversed(history_res.data))
    except Exception as e:
        logger.error(f"Failed to fetch chat history for router_node: {e}")

    router_output = await router_node_llm(
        text=state["raw_input"],
        user_id=user_id,
        memory_context=memory_context,
        current_time_context=state["current_time_context"],
        chat_history=recent_history
    )

    return {
        "dump_type": router_output.get("dump_type", "atomic"),
        "journal_segment": router_output.get("journal_segment"),
        "atomic_items": router_output.get("atomic_items", []),
    }


async def create_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    message_id = state["message_id"]
    new_items = []

    # Journal segment — bucket_service handles same-day merge automatically
    if state.get("journal_segment"):
        try:
            today = state.get("current_time_context", datetime.now().isoformat()).split("T")[0]
            journal_data = {
                "journal_date": today,
                "title": "Daily Entry",
                "content": state["journal_segment"],
                "mood_signal": "neutral"
            }
            db_record = await write_to_bucket(
                user_id=user_id, dump_id=message_id,
                bucket="journals", secondary_buckets=[], extracted_data=journal_data
            )
            new_items.append({
                "id": db_record.get("id") if db_record else None,
                "primary_bucket": "journals",
                "bucket_tags": ["📓 Journal"],
                "confirmation_text": "Added to your journal.",
                "extracted": journal_data,
                "reminder_set": False,
                "reminder_text": None
            })
        except Exception as e:
            logger.error(f"Failed to write journal segment: {e}")

    for item in state.get("atomic_items", []):
        if item.get("action_type") != "CREATE":
            continue
        primary = item.get("primary_bucket", "others")
        extracted = item.get("extracted") or {}
        try:
            db_record = await write_to_bucket(
                user_id=user_id, dump_id=message_id,
                bucket=primary, secondary_buckets=[], extracted_data=extracted
            )
            reminder_set = bool(extracted.get("reminder_required", False))
            due_date = extracted.get("due_date")
            due_time = extracted.get("due_time")
            reminder_text = None
            if reminder_set:
                reminder_text = f"Reminder set for {due_date}" + (f" at {due_time}" if due_time else "") + "."

            title = extracted.get("title") or extracted.get("description") or extracted.get("raw_text", "")
            short = (title[:27] + "...") if len(title) > 30 else title
            confirmation = f"'{short}' saved to {primary.capitalize()}." if short else f"Saved to {primary.capitalize()}."
            if reminder_text:
                confirmation += f"\n{reminder_text}"

            new_items.append({
                "id": db_record.get("id") if db_record else None,
                "primary_bucket": primary,
                "bucket_tags": [_bucket_tag(primary)],
                "confirmation_text": confirmation,
                "extracted": extracted,
                "reminder_set": reminder_set,
                "reminder_text": reminder_text
            })
        except Exception as e:
            logger.error(f"Failed to create item in {primary}: {e}")

    return {"items": new_items, "success": True}


async def _execute_crud(
    user_id: str, bucket: str, operation: str,
    record_id: str, update_fields: Dict, text: str
) -> Dict:
    """Execute the actual DB operation for a fully resolved CRUD item."""
    table = BUCKET_TABLE_MAP.get(bucket, bucket)
    loop = asyncio.get_running_loop()
    try:
        if operation == "DELETE":
            await loop.run_in_executor(None, lambda:
                supabase.table(table).delete()
                    .eq("id", record_id).eq("user_id", user_id).execute()
            )
            memory_store.delete(("memories", user_id), "user_data")
            return {
                "id": record_id, "primary_bucket": bucket,
                "bucket_tags": [_bucket_tag(bucket)],
                "confirmation_text": f"Done. Removed from your {bucket}.",
                "extracted": {}, "reminder_set": False, "reminder_text": None
            }

        elif operation == "UPDATE":
            update_fields = normalize_update_fields(bucket, update_fields)
            if not update_fields:
                return {
                    "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
                    "confirmation_text": f"Got it, but I wasn't sure what to change for \"{text}\". Can you be more specific?",
                    "extracted": {}, "reminder_set": False, "reminder_text": None
                }
            await loop.run_in_executor(None, lambda:
                supabase.table(table).update(update_fields)
                    .eq("id", record_id).eq("user_id", user_id).execute()
            )
            memory_store.delete(("memories", user_id), "user_data")
            return {
                "id": record_id, "primary_bucket": bucket,
                "bucket_tags": [_bucket_tag(bucket)],
                "confirmation_text": f"Updated in your {bucket}. ✓",
                "extracted": update_fields, "reminder_set": False, "reminder_text": None
            }

        elif operation == "APPEND":
            existing = await loop.run_in_executor(None, lambda:
                supabase.table(table).select("content")
                    .eq("id", record_id).limit(1).execute()
            )
            old_content = existing.data[0].get("content", "") if existing.data else ""
            merged = await merge_journals_narrative(old_content, text)
            await loop.run_in_executor(None, lambda:
                supabase.table(table).update({"content": merged})
                    .eq("id", record_id).eq("user_id", user_id).execute()
            )
            memory_store.delete(("memories", user_id), "user_data")
            return {
                "id": record_id, "primary_bucket": "journals",
                "bucket_tags": ["📓 Journal"],
                "confirmation_text": "Appended to today's journal.",
                "extracted": {}, "reminder_set": False, "reminder_text": None
            }

        elif operation == "READ":
            res = await loop.run_in_executor(None, lambda:
                supabase.table(table).select("*")
                    .eq("id", record_id).limit(1).execute()
            )
            data = res.data[0] if res.data else {}
            title_col = "description" if bucket == "finance" else "title"
            readable = data.get(title_col) or data.get("content") or str(data)
            return {
                "id": record_id, "primary_bucket": bucket,
                "bucket_tags": [_bucket_tag(bucket)],
                "confirmation_text": readable,
                "extracted": data, "reminder_set": False, "reminder_text": None
            }

    except Exception as e:
        logger.error(f"CRUD execute failed for {bucket}/{record_id}: {e}", exc_info=True)

    return {
        "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
        "confirmation_text": f"Something went wrong while updating your {bucket}. Please try again.",
        "extracted": {}, "reminder_set": False, "reminder_text": None
    }


async def crud_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    crud_responses = []

    for item in state.get("atomic_items", []):
        if item.get("action_type") != "CRUD":
            continue

        bucket        = item.get("primary_bucket", "others")
        operation     = (item.get("operation") or "UPDATE").upper()
        resolved_id   = item.get("resolved_id")
        update_fields = item.get("update_fields") or {}
        text          = item.get("formatted_text", "")

        # ── READ with no specific ID: return formatted list from memory ────────
        if operation == "READ" and not resolved_id:
            stored = memory_store.get(("memories", user_id), "user_data")
            mem = stored.value if stored and stored.value else {}
            bucket_data = mem.get(bucket, [])
            if not bucket_data:
                crud_responses.append({
                    "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
                    "confirmation_text": f"You have no items in {bucket} right now.",
                    "extracted": {}, "reminder_set": False, "reminder_text": None
                })
            else:
                title_col = "description" if bucket == "finance" else "title"
                lines = []
                for i, entry in enumerate(bucket_data, 1):
                    label = entry.get(title_col) or entry.get("title", "Untitled")
                    if bucket == "tasks" and entry.get("due_date"):
                        label += f" (due {entry['due_date']})"
                    elif bucket == "finance":
                        label += f" — {entry.get('currency','INR')} {entry.get('amount','')}"
                    lines.append(f"{i}. {label}")
                crud_responses.append({
                    "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
                    "confirmation_text": f"Here are your {bucket}:\n" + "\n".join(lines),
                    "extracted": {}, "reminder_set": False, "reminder_text": None
                })
            continue

        # ── Fast path: LLM already resolved the ID from memory ────────────────
        if resolved_id:
            result = await _execute_crud(user_id, bucket, operation, resolved_id, update_fields, text)
            crud_responses.append(result)
            continue

        # ── Fallback: ILIKE fuzzy search ──────────────────────────────────────
        candidates = fuzzy_search_bucket(user_id, bucket, text)

        if len(candidates) == 0:
            crud_responses.append({
                "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
                "confirmation_text": f"I couldn't find anything matching \"{text}\" in your {bucket}.",
                "extracted": {}, "reminder_set": False, "reminder_text": None
            })

        elif len(candidates) == 1:
            result = await _execute_crud(user_id, bucket, operation, candidates[0]["id"], update_fields, text)
            crud_responses.append(result)

        else:
            title_col = "description" if bucket == "finance" else "title"
            options = "\n".join([f"• {c.get(title_col, 'Untitled')}" for c in candidates])
            crud_responses.append({
                "primary_bucket": bucket, "bucket_tags": [_bucket_tag(bucket)],
                "confirmation_text": f"I found {len(candidates)} matches for \"{text}\":\n{options}\n\nWhich one did you mean?",
                "extracted": {}, "reminder_set": False, "reminder_text": None
            })

    return {"items": crud_responses, "success": True}



CHATBOT_SYSTEM_PROMPT = """You are Dumpo, a warm, intelligent, and helpful AI assistant for the Dumpo productivity app.
Your name is Dumpo. You are concise, friendly, and helpful. You remember details shared by the user in previous conversation turns.
Always maintain your identity as Dumpo and refer to yourself as Dumpo when asked."""


async def chatbot_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    loop = asyncio.get_running_loop()

    # Reuse chat history fetched by router
    recent_history = state.get("chat_history", [])
    # (Removed redundant fetch since router now provides chat_history)

    chat_responses = []
    for item in state.get("atomic_items", []):
        if item.get("action_type") != "CHAT":
            continue
        text = item.get("formatted_text", "")
        
        # Build prompt payload: System Persona + Recent Chat History + Current Prompt
        messages = [{"role": "system", "content": CHATBOT_SYSTEM_PROMPT}]
        for msg in recent_history:
            role = msg.get("role")
            content = msg.get("content")
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content})
        
        # Prevent duplicating the current message if already logged
        if not messages or messages[-1]["content"] != text:
            messages.append({"role": "user", "content": text})

        try:
            completion = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=0.7
                )
            )
            reply = completion.choices[0].message.content
            chat_responses.append({
                "primary_bucket": "chat", "bucket_tags": ["💬 Chat"],
                "confirmation_text": reply, "extracted": {},
                "reminder_set": False, "reminder_text": None
            })
        except Exception as e:
            logger.error(f"Chatbot failed: {e}")

    return {"items": chat_responses, "success": True}


async def output_compiler_node(state: AgentState) -> AgentState:
    return {"success": True}


def route_from_router(state: AgentState) -> List[str]:
    destinations = []
    if state.get("journal_segment"):
        destinations.append("create_node")

    has_create = has_crud = has_chat = False
    for item in state.get("atomic_items", []):
        act = item.get("action_type")
        if act == "CREATE":   has_create = True
        elif act == "CRUD":   has_crud = True
        elif act == "CHAT":   has_chat = True

    if has_create and "create_node" not in destinations:
        destinations.append("create_node")
    if has_crud:
        destinations.append("crud_node")
    if has_chat:
        destinations.append("chatbot_node")

    return destinations or ["create_node"]


# ─── Graph Assembly ───────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)
workflow.add_node("router_node",         router_node)
workflow.add_node("create_node",         create_node)
workflow.add_node("crud_node",           crud_node)
workflow.add_node("chatbot_node",        chatbot_node)
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

dumpo_graph = workflow.compile(store=memory_store)


# ─── Entry Point ─────────────────────────────────────────────────────────────
async def process_user_dump_graph(
    user_id: str, message_id: str, text: str,
    current_time_context: Optional[str] = None
) -> Dict[str, Any]:

    initial_state: AgentState = {
        "raw_input": text,
        "user_id": user_id,
        "message_id": message_id,
        "current_time_context": current_time_context,
        "chat_history": [],
        "dump_type": "",
        "journal_segment": None,
        "atomic_items": [],
        "response_messages": [],
        "bucket_tags": [],
        "items": [],
        "success": False
    }

    try:
        supabase.table("chat_messages").insert({
            "id": message_id, "user_id": user_id, "content": text, "role": "user"
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log user chat message: {e}")

    final_state = await dumpo_graph.ainvoke(initial_state)
    response_items = final_state.get("items", [])

    for item in response_items:
        try:
            supabase.table("chat_messages").insert({
                "user_id": user_id,
                "content": item.get("confirmation_text", ""),
                "role": "assistant",
                "bucket_tags": item.get("bucket_tags", []),
                "reminder_set": item.get("reminder_set", False),
                "reminder_text": item.get("reminder_text"),
                "items": [item]
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log assistant chat message: {e}")

    return {"success": True, "items": response_items}
