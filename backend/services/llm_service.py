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

SYSTEM_PROMPT = """You are Dumpo's classification engine. Your task is to process the user's raw thought dumps.

OUTPUT: Return only a valid JSON object. No markdown formatting (like ```json), no chat prose, and no explanations.
FORMAT: { "items": [ { "primary_bucket": string, "secondary_buckets": string[], "confidence": float, "formatted_text": string, "extracted": object } ] }

STEP 1 — FORMAT: Fix typos and correct grammar. Do not change the core meaning. Do not add external facts or details. Output must always be formatted in English.

STEP 2 — SPLIT: If the formatted raw thought contains multiple independent items or thoughts (for example, a finance transaction AND a task, or a journal entry AND a task), you MUST split them and return them as separate objects in the "items" array. Never combine independent actions/thoughts into a single item.

STEP 3 — CLASSIFY: Classify each split item into a primary_bucket using this decision table:

| Bucket    | Classify here when...                      | Key signals                          |
|-----------|---------------------------------------------|--------------------------------------|
| tasks     | User needs to DO something                  | need to, call, send, buy, by [date]  |
| ideas     | Exploratory thought, no action needed       | what if, maybe, concept, app idea    |
| journals  | Feeling or personal reflection              | felt, exhausted, today was, realised |
| finance   | Money involved (debts, expenses, income)    | spent, owe, paid, rupees, amount     |
| health    | Physical/mental wellness, symptoms, workouts| gym, slept, sick, headache, workout  |
| watchlist | Media to watch/read or already watched      | watch, movie, show, netflix, anime   |
| others    | Does not clearly fit above (confidence<0.6) | fallback                             |

STEP 4 — EXTRACT: Populate the exact fields defined in the schema for that item's primary_bucket. The fields must be at the root of the "extracted" object. Do NOT nest them inside a key with the bucket name.

STEP 5 — CROSS-BUCKET: If the item strongly applies to a second bucket as well, add it to secondary_buckets (excluding the primary).

BOUNDARY RULES:
- "Should probably go to gym" -> ideas (exploratory). "Go to gym tomorrow 7am" -> tasks (action + time commitment).
- "Aryan owes me 500" -> finance/receive. "I owe Aryan 500" -> finance/pay.
- "Lent Priya 200" -> finance/receive. "Borrowed 300 from Rohan" -> finance/pay.
- "Felt tired today" -> journals. "Need to fix my sleep schedule" -> tasks.
- "Peaky Blinders is amazing" -> others (no watch intent). "Watch Peaky Blinders" -> watchlist.
- Negation: "Meeting NOT on Monday" is not a task for Monday.
- Past tense: "Reviewed what happened last Tuesday" is not a future task.
- Hinglish: Classify based on meaning, not language.

GENRE MAPPING RULES:
You must select only one of these genres for watchlist: "action"|"thriller"|"comedy"|"horror"|"romance"|"others".
- "Watch Peaky Blinders" -> genre: thriller
- "Watch Interstellar" -> genre: others (since sci-fi is not in the allowed list)
- "Watch Friends" -> genre: comedy
- "Watch Conjuring" -> genre: horror
- "Watch Titanic" -> genre: romance

FINANCE DIRECTION RULES:
- pay = money leaving user's pocket (user owes someone). You MUST set category to "pay". Signals: "I owe", "need to pay", "gave loan to", "borrowed from".
- receive = money coming to user (someone owes user). You MUST set category to "receive". Signals: "owes me", "lent to", "gave money to [person]", "borrowed by".

CONFIDENCE: If genuinely ambiguous, set confidence below 0.6 to auto-route to others.
"""

SCHEMA_REFERENCE = """EXTRACTION SCHEMAS (populate these fields directly in the "extracted" object):
- tasks: { "title": "string", "due_date": "YYYY-MM-DD" or null, "due_time": "HH:MM" or null, "reminder_required": boolean }
  * Note: If due_date or due_time is detected, reminder_required must be true (default time is "09:00" if date exists but no time).
- ideas: { "title": "string", "description": "a 1-2 sentence expansion of the idea or null" }
- journals: { "journal_date": "YYYY-MM-DD", "title": "string", "content": "string", "mood_signal": "positive"|"negative"|"neutral" }
- finance: { "description": "string", "amount": number, "currency": "INR"|"USD"|..., "category": "food"|"groceries"|"transport"|"shopping"|"entertainment"|"health"|"pay"|"receive"|"others", "is_settled": boolean }
- health: { "title": "string", "description": "string", "health_type": "physical"|"mental"|"medical"|"nutrition" }
- watchlist: { "title": "string", "genre": "action"|"thriller"|"comedy"|"horror"|"romance"|"others", "content_type": "movie"|"show"|"documentary"|"anime"|null, "platform": "string"|null, "year_of_launch": "string"|null, "language": "string"|null, "is_watched": boolean }
- others: { "raw_text": "string" }
"""

def clean_response_text(text: str) -> str:
    """Extract and return only the JSON content between the outer brackets."""
    text = text.strip()
    first_bracket = text.find("{")
    last_bracket = text.rfind("}")
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        return text[first_bracket:last_bracket + 1]
    return text

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
        category = str(extracted.get("category", "others")).lower()
        allowed_categories = ["food", "groceries", "transport", "shopping", "entertainment", "health", "pay", "receive", "others"]
        if category not in allowed_categories:
            extracted["category"] = "others"
        else:
            extracted["category"] = category
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
        genre = str(extracted.get("genre", "others")).lower()
        allowed_genres = ["action", "thriller", "comedy", "horror", "romance", "others"]
        if genre not in allowed_genres:
            extracted["genre"] = "others"
        else:
            extracted["genre"] = genre
        extracted["is_watched"] = bool(extracted.get("is_watched", False))

    elif bucket == "others":
        extracted["raw_text"] = formatted_text

    return extracted

async def classify_dump(text: str, user_id: str, current_time_context: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Call Groq API using Llama 3.1 8B to format, split, classify and extract structured data from dump text.
    """
    if not text or not text.strip():
        return [{
            "primary_bucket": "others",
            "secondary_buckets": [],
            "confidence": 0.5,
            "formatted_text": "",
            "extracted": {
                "raw_text": ""
            }
        }]

    # Input length guard
    if len(text) > 1500:
        text = text[:1500] + " [truncated due to length]"

    # Fallback to local Indian Standard Time (IST, UTC+5:30) to avoid timezone offsets causing date mismatches
    if not current_time_context:
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        current_time_context = datetime.now(ist_tz).isoformat()

    # Extract date representation from time context for journal/task default fallbacks
    try:
        default_date = current_time_context.split("T")[0]
    except Exception:
        default_date = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()

    user_prompt = f"{SCHEMA_REFERENCE}\nCurrent Time Context: {current_time_context}\nRaw Thought: {text}"
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            # Groq client's create call is synchronous under sync client, but we call it asynchronously inside
            # loop or run it in executor if needed. Since it's a network request, making the wrapper async and
            # using await asyncio.sleep preserves non-blocking retry wait, which is the main event-loop hog.
            # To be truly non-blocking during network I/O, we can run Groq client inside an asyncio thread executor.
            loop = asyncio.get_running_loop()
            completion = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
            )
            
            response_text = completion.choices[0].message.content
            cleaned_text = clean_response_text(response_text)
            data = json.loads(cleaned_text)
            
            items = data.get("items", [])
            
            # Enforce schema validation and defaults
            for item in items:
                primary = item.get("primary_bucket", "others")
                formatted_text = item.get("formatted_text", text)
                confidence = item.get("confidence", 1.0)
                
                # Confidence check fallback
                if confidence < 0.6:
                    item["primary_bucket"] = "others"
                    item["secondary_buckets"] = []
                    item["extracted"] = {"raw_text": formatted_text}
                else:
                    item["extracted"] = validate_extracted_fields(
                        primary,
                        item.get("extracted", {}),
                        formatted_text,
                        default_date
                    )
            
            # Deduplication check before returning items
            seen_texts = set()
            deduped_items = []
            for item in items:
                fmt_text = item.get("formatted_text", "").strip().lower()
                if fmt_text not in seen_texts:
                    seen_texts.add(fmt_text)
                    deduped_items.append(item)
                    
            return deduped_items
            
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Groq classification failed for user {user_id} after {max_retries} attempts | Error: {str(e)}")
                break
            else:
                await asyncio.sleep(1.0)
                
    # Direct fallback return statement to guarantee List return
    return [{
        "primary_bucket": "others",
        "secondary_buckets": [],
        "confidence": 0.5,
        "formatted_text": text,
        "extracted": {
            "raw_text": text
        }
    }]

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
        "- Keep the narrative under 250 words and chronological.\n"
        "- Do not add external facts or imaginary events. Just merge the provided text."
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
