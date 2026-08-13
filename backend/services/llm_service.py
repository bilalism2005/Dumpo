import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from groq import Groq
from backend.config import settings

logger = logging.getLogger(__name__)

# Initialize Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

# Define the Groq model
MODEL_NAME = "llama-3.1-8b-instant"

ROUTER_SYSTEM_PROMPT = """You are Dumpo's Router and Classification engine. Your task is to process the user's raw thought dumps, fix grammar, split them, classify their type, and route them.

OUTPUT: Return only a valid JSON object. No markdown formatting (like ```json), no chat prose.
FORMAT: 
{ 
  "dump_type": "narrative" | "atomic" | "mixed",
  "journal_segment": "<extracted narrative string> or null",
  "atomic_items": [ 
    { 
      "action_type": "CREATE" | "CRUD" | "CHAT",
      "primary_bucket": "<bucket_name> or null",
      "formatted_text": "<string>", 
      "extracted": { <key_value_pairs> or null },
      "resolved_id": "<string_uuid> or null",
      "operation": "<string> or null",
      "update_fields": { <key_value_pairs> or null },
      "confidence": <float_0_to_1>
    } 
  ] 
}

STEP 1 — FORMAT: Fix typos and correct grammar. Translate Hinglish to English. Do not add external facts.

STEP 2 — DUMP TYPE:
- narrative: A continuous story or journal entry (e.g., "Today was great, I went to the park.").
- atomic: One or more specific actions/tasks/ideas (e.g., "Remind me to call John.", "I owe Alice 10.", "What if we build an AI app?").
- mixed: A combination of both (e.g., "Today was tiring. Also remind me to pay rent.").

STEP 3 — JOURNAL SEGMENT: If dump_type is narrative or mixed, extract the continuous story part into `journal_segment`. Otherwise null.
- If the Memory Context contains a journal for today's date, set journal_segment to the narrative text — the system handles merging.
- IMPORTANT: Narrative content extracted into `journal_segment` MUST NOT be duplicated as separate `atomic_items`.

STEP 4 — SPLIT & ROUTE ATOMIC ITEMS:
For each item, determine its `action_type`:

- CRUD: Use this when the user is reading, updating, or deleting something that ALREADY EXISTS in their data.
  - READING their own data: "What are my pending tasks?", "Show my tasks" → CRUD READ
  - UPDATING: "Mark meeting with John as done", "I watched Interstellar", "Aryan paid me back" → CRUD UPDATE
  - DELETING: "Cancel my meeting", "Remove the gym task" → CRUD DELETE
  - APPENDING to journal: "Also add that I had pizza" → CRUD APPEND
  USE THE MEMORY CONTEXT to find resolved_id. Set operation to UPDATE/DELETE/APPEND/READ.

- CHAT: ONLY for general knowledge questions with NO connection to the user's stored data, OR when answering a direct question from the Chat Context (e.g. "Yes").
  Examples of CHAT: "What is the capital of France?", "Should I work out today?"
  Examples NOT chat (they are CRUD): "What are my tasks?", "Did I run today?"

- CREATE: Adding a brand new item that does NOT exist in memory context.
  IMPORTANT TASK RULES:
  - Any statement about meetings, appointments, or schedules (e.g., "Meeting with Nafis at 1:03 AM") is a CREATE in `tasks`.
  - Commands to set a reminder (e.g., "Remind me to check alerts") are CREATE in `tasks` with `reminder_required: true`. Do NOT classify these as CRUD READ!

For CRUD items, populate:
- "resolved_id": exact "id" from Memory Context for the matching item, or null.
- "operation": "UPDATE" | "DELETE" | "APPEND" | "READ"
- "update_fields": object with only valid table columns to change for UPDATE, null otherwise:
  - For tasks completion: MUST use `{ "is_complete": true }` (or false to uncomplete).
  - For watchlist: MUST use `{ "is_watched": true }`.
  - For finance: MUST use `{ "is_settled": true }`.
  - Do NOT use invalid field names like "status", "done".

STEP 5 — CLASSIFY bucket (CREATE & CRUD only):
Classify into: tasks | ideas | journals | finance | health | watchlist | others.

WATCHLIST RULES & CONTEXT:
- Classify into `watchlist` ONLY if there is clear media intent OR if the Chat Context shows you just asked the user if they wanted to add it to their watchlist and they replied affirmatively.
- UNCERTAINTY RULE: If you are NOT SURE whether a word/phrase is a movie/show, classify it into `others`.

FINANCE RULES:
- Classify into `finance` for any monetary transactions, debts, or expenses.
"""


SCHEMA_REFERENCE = """EXTRACTION SCHEMAS (populate these fields directly in the "extracted" object):
- tasks: { "title": "<task_title>", "due_date": "YYYY-MM-DD" or null, "due_time": "HH:MM" or null, "reminder_required": <boolean> }
- ideas: { "title": "<idea_title>", "description": "<description> or null" }
- journals: { "journal_date": "YYYY-MM-DD", "title": "<title>", "content": "<content>", "mood_signal": "positive"|"negative"|"neutral" }
- finance: { "description": "<desc>", "amount": <number>, "currency": "INR"|"USD"|..., "is_settled": <boolean> }
- health: { "title": "<title>", "description": "<desc>", "health_type": "physical"|"mental"|"medical"|"nutrition" }
- watchlist: { "title": "<movie_or_show_title>", "content_type": "movie"|"show"|null, "platform": "<platform>"|null, "year_of_launch": "<year>"|null, "language": "<lang>"|null, "is_watched": <boolean> }
- others: { "raw_text": "<text>" }
"""

def clean_response_text(text: str) -> str:
    """Extract and return only the JSON content between the outer brackets."""
    text = text.strip()
    first_bracket = text.find("{")
    last_bracket = text.rfind("}")
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        return text[first_bracket:last_bracket + 1]
    return text

def validate_crud_fields(bucket: str, resolved_id: Optional[str], update_fields: Dict[str, Any], memory_context: str) -> (Optional[str], Dict[str, Any]):
    """Ensure CRUD safety: discard hallucinated IDs and whitelist update fields."""
    if resolved_id and resolved_id not in memory_context:
        resolved_id = None
        
    if update_fields and isinstance(update_fields, dict):
        allowed = {
            "tasks": ["is_complete", "title", "due_date", "due_time", "reminder_required"],
            "watchlist": ["is_watched", "title", "content_type", "platform", "language", "year_of_launch"],
            "finance": ["is_settled", "description", "amount", "currency"],
            "ideas": ["title", "description"],
            "journals": ["title", "content"],
            "health": ["title", "description", "health_type"],
            "others": ["raw_text"]
        }.get(bucket, [])
        update_fields = {k: v for k, v in update_fields.items() if k in allowed}
    else:
        update_fields = {}
        
    return resolved_id, update_fields

def validate_extracted_fields(bucket: str, extracted: Dict[str, Any], formatted_text: str, default_date: str) -> Dict[str, Any]:
    """Ensure that the extracted data matches expected schemas and has fallback values if LLM misses them."""
    if not isinstance(extracted, dict):
        extracted = {}

    if bucket == "tasks":
        if "title" not in extracted or not str(extracted.get("title", "")).strip():
            extracted["title"] = formatted_text[:100] if formatted_text else "Unnamed Task"
        extracted["reminder_required"] = bool(extracted.get("reminder_required", False))
        due_date = extracted.get("due_date")
        if due_date:
            try:
                datetime.strptime(str(due_date), "%Y-%m-%d")
            except ValueError:
                extracted["due_date"] = None
        due_time = extracted.get("due_time")
        if due_time:
            try:
                datetime.strptime(str(due_time), "%H:%M")
            except ValueError:
                extracted["due_time"] = None
        if (extracted.get("due_date") or extracted.get("due_time")) and not extracted.get("reminder_required"):
            extracted["reminder_required"] = True

    elif bucket == "ideas":
        if "title" not in extracted or not str(extracted.get("title", "")).strip():
            extracted["title"] = formatted_text[:100] if formatted_text else "Unnamed Idea"
        if "description" not in extracted:
            extracted["description"] = None

    elif bucket == "journals":
        if "journal_date" not in extracted:
            extracted["journal_date"] = default_date
        else:
            try:
                datetime.strptime(str(extracted["journal_date"]), "%Y-%m-%d")
            except ValueError:
                extracted["journal_date"] = default_date
        if "title" not in extracted or not str(extracted.get("title", "")).strip():
            extracted["title"] = "Daily Entry"
        if "content" not in extracted or not str(extracted.get("content", "")).strip():
            extracted["content"] = formatted_text if formatted_text else "No content"
        mood = str(extracted.get("mood_signal", "neutral")).lower()
        if mood not in ["positive", "negative", "neutral"]:
            extracted["mood_signal"] = "neutral"
        else:
            extracted["mood_signal"] = mood

    elif bucket == "finance":
        if "description" not in extracted or not str(extracted.get("description", "")).strip():
            extracted["description"] = formatted_text[:100] if formatted_text else "Unnamed Transaction"
        try:
            extracted["amount"] = float(extracted.get("amount", 0.0))
        except (ValueError, TypeError):
            extracted["amount"] = 0.0
        extracted["currency"] = str(extracted.get("currency", "INR"))
        extracted["category"] = "others"
        extracted["is_settled"] = bool(extracted.get("is_settled", False))

    elif bucket == "health":
        if "title" not in extracted or not str(extracted.get("title", "")).strip():
            extracted["title"] = formatted_text[:100] if formatted_text else "Unnamed Health Entry"
        if "description" not in extracted:
            extracted["description"] = formatted_text
        ht = str(extracted.get("health_type", "physical")).lower()
        if ht not in ["physical", "mental", "medical", "nutrition"]:
            extracted["health_type"] = "physical"
        else:
            extracted["health_type"] = ht

    elif bucket == "watchlist":
        if "title" not in extracted or not str(extracted.get("title", "")).strip():
            extracted["title"] = formatted_text[:100] if formatted_text else "Unnamed Movie/Show"
        extracted["genre"] = "others"
        extracted["is_watched"] = bool(extracted.get("is_watched", False))

    elif bucket == "others":
        extracted["raw_text"] = formatted_text

    return extracted

async def router_node_llm(text: str, user_id: str, memory_context: str = "", current_time_context: Optional[str] = None, chat_history: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call Groq API using Llama 3.1 8B to format, split, classify, route, and extract structured data from dump text.
    """
    if not text or not text.strip():
        return {
            "dump_type": "atomic",
            "journal_segment": None,
            "atomic_items": [{
                "action_type": "CHAT",
                "primary_bucket": "others",
                "formatted_text": "",
                "extracted": {"raw_text": ""}
            }]
        }

    # Input length guard
    if len(text) > 1500:
        text = text[:1500] + " [truncated due to length]"

    # Format chat history for context
    chat_context = ""
    if chat_history:
        formatted_msgs = []
        # Cap chat history to last 5 turns to prevent token explosion
        for msg in chat_history[:5]:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            formatted_msgs.append(f"{role.capitalize()}: {content}")
        chat_context = "\n".join(formatted_msgs)
        if len(chat_context) > 2000:
            chat_context = chat_context[:2000] + "\n[truncated]"
        
    # Use UTC if no time context provided
    if not current_time_context:
        current_time_context = datetime.now(timezone.utc).isoformat()

    # Extract date representation from time context for journal/task default fallbacks
    try:
        default_date = current_time_context.split("T")[0]
    except Exception:
        default_date = datetime.now(timezone.utc).date().isoformat()

    user_prompt = f"{SCHEMA_REFERENCE}\nCurrent Time Context: {current_time_context}\nChat Context:\n{chat_context}\n\nMemory Context:\n{memory_context}\n\nRaw Thought: {text}"
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            loop = asyncio.get_running_loop()
            completion = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
            )
            
            response_text = completion.choices[0].message.content
            cleaned_text = clean_response_text(response_text)
            data = json.loads(cleaned_text)
            
            # Enforce schema validation and defaults on atomic_items
            items = data.get("atomic_items", [])
            for item in items:
                primary = item.get("primary_bucket", "others")
                if not primary:
                     primary = "others"
                formatted_text = item.get("formatted_text", text)
                
                # Only validate extracted fields if action_type is CREATE
                if item.get("action_type") == "CREATE":
                    item["extracted"] = validate_extracted_fields(
                        primary,
                        item.get("extracted") or {},
                        formatted_text,
                        default_date
                    )
                elif item.get("action_type") == "CRUD":
                    if not item.get("extracted"):
                         item["extracted"] = {}
                    
                    # Validate CRUD ID and fields
                    r_id = item.get("resolved_id")
                    u_fields = item.get("update_fields") or {}
                    safe_id, safe_fields = validate_crud_fields(primary, r_id, u_fields, memory_context)
                    item["resolved_id"] = safe_id
                    item["update_fields"] = safe_fields
                    
                    # If confidence is low, discard resolved_id to force clarification prompt
                    conf = item.get("confidence", 1.0)
                    if conf < 0.6 and item.get("operation") in ["UPDATE", "DELETE", "APPEND"]:
                        item["resolved_id"] = None
                        
                else:
                    item["extracted"] = {"raw_text": formatted_text}
            
            # Deduplication check for atomic_items
            seen_texts = set()
            deduped_items = []
            for item in items:
                fmt_text = item.get("formatted_text", "").strip().lower()
                if fmt_text not in seen_texts:
                    seen_texts.add(fmt_text)
                    deduped_items.append(item)
                    
            data["atomic_items"] = deduped_items
            return data
            
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Groq classification failed for user {user_id} after {max_retries} attempts | Error: {str(e)}")
                break
            else:
                await asyncio.sleep(1.0)
                
    # Direct fallback return statement
    return {
        "dump_type": "atomic",
        "journal_segment": None,
        "atomic_items": [{
            "action_type": "CREATE",
            "primary_bucket": "others",
            "formatted_text": text,
            "extracted": {"raw_text": text}
        }]
    }

async def merge_journals_narrative(old_content: str, new_content: str, journal_date: Optional[str] = None) -> str:
    """
    Use LLM to merge two journal entries for the same day into one clean narrative.
    """
    # Merge input length guards
    if len(old_content) > 600:
        old_content = old_content[:600] + " [truncated]"
    if len(new_content) > 600:
        new_content = new_content[:600] + " [truncated]"

    date_context = f" for date {journal_date}" if journal_date else ""
    prompt = f"Merge the following two journal entries into one cohesive, clean, chronological narrative{date_context}. Do not lose key details.\n\nEntry 1:\n{old_content}\n\nEntry 2:\n{new_content}\n\nMerged Narrative:"
    
    system_prompt = (
        "You are a helpful journal editing assistant. Combine the thoughts into a single clean story. "
        "Instructions:\n"
        "- Output plain prose only. Do not write markdown, bold headers, or bullet points.\n"
        "- Maintain the casual, reflective, personal tone of the original entries.\n"
        "- MAKE MINIMAL EDITS. Only fix spelling mistakes and ensure chronological sequence.\n"
        "- DO NOT hallucinate, DO NOT add extra flowery language, and DO NOT make the entry longer than the original text.\n"
        "- Do not add external facts or imaginary events. Just merge the provided text exactly as it was meant."
    )
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            loop = asyncio.get_running_loop()
            completion = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.4 # Slightly increased to 0.4 for more natural narrative flows
                )
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to merge journal narratives after {max_retries} attempts | Error: {str(e)}")
                return f"{old_content}\n\n{new_content}"
            else:
                await asyncio.sleep(1.0)

    return f"{old_content}\n\n{new_content}"
