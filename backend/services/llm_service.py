import os
import json
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
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

STEP 1 — SPLIT: If the raw thought contains multiple independent items or thoughts (for example, a finance transaction AND a task, or a journal entry AND a task), you MUST split them and return them as separate objects in the "items" array. Never combine independent actions/thoughts into a single item.

STEP 2 — CLASSIFY: Classify each split item into a primary_bucket using this decision table:

| Bucket    | Classify here when...                      | Key signals                          |
|-----------|---------------------------------------------|--------------------------------------|
| tasks     | User needs to DO something                  | need to, call, send, buy, by [date]  |
| ideas     | Exploratory thought, no action needed       | what if, maybe, concept, app idea    |
| journals  | Feeling or personal reflection              | felt, exhausted, today was, realised |
| finance   | Money involved (debts, expenses, income)    | spent, owe, paid, rupees, amount     |
| health    | Physical/mental wellness, symptoms, workouts| gym, slept, sick, headache, workout  |
| watchlist | Media to watch/read or already watched      | watch, movie, show, netflix, anime   |
| others    | Does not clearly fit above (confidence<0.6) | fallback                             |

STEP 3 — FORMAT & EXTRACT:
- For each item, fix typos and correct grammar. Do not change the meaning. Do not add details.
- In "extracted", populate the exact fields defined in the schema for that item's primary_bucket. The fields must be at the root of the "extracted" object. Do NOT nest them inside a key with the bucket name.

STEP 4 — CROSS-BUCKET: If the item strongly applies to a second bucket as well, add it to secondary_buckets (excluding the primary).

BOUNDARY RULES:
- "Should probably go to gym" -> ideas (exploratory). "Go to gym tomorrow 7am" -> tasks (action + time commitment).
- "Aryan owes me 500" -> finance/receive. "I owe Aryan 500" -> finance/pay.
- "Lent Priya 200" -> finance/receive. "Borrowed 300 from Rohan" -> finance/pay.
- "Felt tired today" -> journals. "Need to fix my sleep schedule" -> tasks.
- "Peaky Blinders is amazing" -> others (no watch intent). "Watch Peaky Blinders" -> watchlist.
- Negation: "Meeting NOT on Monday" is not a task for Monday.
- Past tense: "Reviewed what happened last Tuesday" is not a future task.
- Hinglish: Classify based on meaning, not language. Output must always be formatted in English.

FINANCE DIRECTION RULES:
- pay = money leaving user's pocket (user owes someone). You MUST set category to "pay". Signals: "I owe", "need to pay", "gave loan to", "borrowed from".
- receive = money coming to user (someone owes user). You MUST set category to "receive". Signals: "owes me", "lent to", "gave money to [person]", "borrowed by".

CONFIDENCE: If genuinely ambiguous, set confidence below 0.6 to auto-route to others.
"""

SCHEMA_REFERENCE = """EXTRACTION SCHEMAS (populate these fields directly in the "extracted" object):
- tasks: { "title": "string", "due_date": "YYYY-MM-DD" or null, "due_time": "HH:MM" or null, "reminder_required": boolean }
  * Note: If due_date or due_time is detected, reminder_required must be true (default time is "09:00" if date exists but no time).
- ideas: { "title": "string", "description": "string" or null }
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

def classify_dump(text: str, user_id: str, current_time_context: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Call Groq API using Llama 3.1 8B to format, split, classify and extract structured data from dump text.
    """
    # Input length guard
    if len(text) > 1500:
        text = text[:1500] + " [truncated due to length]"

    if not current_time_context:
        current_time_context = datetime.now(timezone.utc).isoformat()

    user_prompt = f"{SCHEMA_REFERENCE}\nCurrent Time Context: {current_time_context}\nRaw Thought: {text}"
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            response_text = completion.choices[0].message.content
            cleaned_text = clean_response_text(response_text)
            data = json.loads(cleaned_text)
            
            items = data.get("items", [])
            
            # Enforce defaults/routing for confidence < 0.6
            for item in items:
                confidence = item.get("confidence", 1.0)
                if confidence < 0.6:
                    item["primary_bucket"] = "others"
                    item["secondary_buckets"] = []
                    item["extracted"] = {"raw_text": item.get("formatted_text", text)}
                    
            return items
            
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Groq classification failed for user {user_id} after {max_retries} attempts | Error: {str(e)}")
                # Fallback to 'others' bucket
                return [{
                    "primary_bucket": "others",
                    "secondary_buckets": [],
                    "confidence": 0.5,
                    "formatted_text": text,
                    "extracted": {
                        "raw_text": text
                    }
                }]
            else:
                time.sleep(1.0)

def merge_journals_narrative(old_content: str, new_content: str, journal_date: Optional[str] = None) -> str:
    """
    Use LLM to merge two journal entries for the same day into one clean narrative.
    """
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
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to merge journal narratives after {max_retries} attempts | Error: {str(e)}")
                return f"{old_content}\n\n{new_content}"
            else:
                time.sleep(1.0)
