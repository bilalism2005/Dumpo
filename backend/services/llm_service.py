import os
import json
import logging
from typing import List, Dict, Any, Optional
from groq import Groq
from backend.config import settings

logger = logging.getLogger(__name__)

# Initialize Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

# Define the Groq model
MODEL_NAME = "llama-3.1-8b-instant"

SYSTEM_PROMPT = """You are Dumpo's core classification engine. Your task is to process a raw user thought/dump, split it if it contains multiple independent items, format/clean each item, classify them into buckets, and extract structured metadata.

You must respond with a JSON object containing an "items" array. Absolutely no markdown formatting (like ```json), no chat prose, and no explanation. Just raw JSON.

### Buckets & Criteria:
1. "tasks":
   - Criteria: Anything the user needs to DO. Has clear action intent or obligation.
   - Signals: Action verbs (call, send, buy, book, review, etc.), obligations (need to, have to, must), time refs (today, tomorrow, by Friday, 5pm).
   - Extracted schema: { "title": "string", "due_date": "YYYY-MM-DD" or null, "due_time": "HH:MM" or null, "reminder_required": boolean }
   - Note: If due_date or due_time is detected, reminder_required must be true. Default reminder time if date exists but no time is "09:00".
   - Negations/Past: "Meeting NOT on Monday" or "Reviewed what happened last Tuesday" are NOT tasks.
   
2. "ideas":
   - Criteria: Raw thoughts, concepts, side projects, startup ideas. No immediate action required.
   - Signals: "what if", "maybe", "I think", "concept", "app idea", "business idea".
   - Extracted schema: { "title": "string", "description": "string" }
   
3. "journals":
   - Criteria: Reflections, feelings, observations, diary-like entries about the day or life. Personal and expressive. No action intent.
   - Signals: "feeling", "felt", "exhausted", "happy", "realised", "noticed", "today was".
   - Extracted schema: { "journal_date": "YYYY-MM-DD", "title": "string", "content": "string", "mood_signal": "positive"|"negative"|"neutral" }
   - Note: journal_date defaults to current date if not specified.
   
4. "finance":
   - Criteria: Anything money-related. Expenses, income, debt.
   - Signals: Spent, paid, cost, rupees, rs, inr, owe, lend, borrow, amount.
   - Categories: 'food','groceries','transport','shopping','entertainment','health','pay','receive','others'
   - Extracted schema: { "description": "string", "amount": number, "currency": "INR"|"USD"|..., "category": "string", "is_settled": boolean }
   - Note: "Pay" is money user owes someone (is_settled=false initially). "Receive" is money someone owes user.
   
5. "health":
   - Criteria: Physical or mental health. Workouts, symptoms, medications, sleep, nutrition.
   - Signals: Gym, run, workout, headache, sick, diet, protein, slept.
   - Extracted schema: { "title": "string", "description": "string", "health_type": "physical"|"mental"|"medical"|"nutrition" }
   
6. "watchlist":
   - Criteria: Movies, TV shows, books, anime to watch or read.
   - Signals: watch, seen, want to watch, recommendation, netflix, show.
   - Extracted schema: { "title": "string", "genre": "string", "content_type": "movie"|"show"|"documentary"|"anime"|null, "platform": "string"|null, "year_of_launch": "string"|null, "language": "string"|null, "is_watched": boolean }
   
7. "others":
   - Criteria: Fallback. Random facts, gibberish, test inputs, or if confidence is below 0.6.
   - Extracted schema: { "raw_text": "string" }

### Rules for Splitting & Formatting:
- Splitting: Split independent thoughts (e.g. "Call mom tomorrow and had a great app idea" -> Task (Call mom) + Idea (app idea)).
- Formatting: Fix typos, correct grammar, make concise. Do NOT change meaning. Do NOT add details.
- Cross-bucket tagging: If a thought strongly applies to a secondary bucket, specify it in "secondary_buckets" (e.g. "Do a health checkup today" -> primary "tasks", secondary ["health"]).

### Example Output:
{
  "items": [
    {
      "primary_bucket": "tasks",
      "secondary_buckets": ["health"],
      "confidence": 0.92,
      "formatted_text": "Do a health checkup today",
      "extracted": {
        "title": "Health checkup",
        "due_date": "2026-06-28",
        "due_time": null,
        "reminder_required": true
      }
    }
  ]
}
"""

def clean_response_text(text: str) -> str:
    """Strip markdown formatting if present."""
    text = text.strip()
    if text.startswith("```"):
        # Remove starting ```json or ```
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

def classify_dump(text: str, user_id: str, current_time_context: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Call Groq API using Llama 3.1 8B to format, split, classify and extract structured data from dump text.
    """
    if not current_time_context:
        current_time_context = "2026-07-05T15:52:27+05:30" # Match context timestamp

    user_prompt = f"Current Time Context: {current_time_context}\nRaw Thought: {text}"
    
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
        logger.error(f"Groq classification failed for user {user_id} | Error: {str(e)}", exc_info=True)
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

def merge_journals_narrative(old_content: str, new_content: str) -> str:
    """
    Use LLM to merge two journal entries for the same day into one clean narrative.
    """
    prompt = f"Merge the following two journal entries into one cohesive, clean, chronological narrative. Do not lose key details.\n\nEntry 1:\n{old_content}\n\nEntry 2:\n{new_content}\n\nMerged Narrative:"
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful journal editing assistant. Combine the thoughts into a single clean story of the day. Do not add external facts. Do not write markdown. Just output the clean text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Failed to merge journal narratives: {str(e)}")
        return f"{old_content}\n\n{new_content}"

