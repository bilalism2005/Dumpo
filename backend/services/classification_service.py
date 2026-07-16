import logging
from typing import Dict, Any, List, Optional
from backend.services.supabase_service import get_supabase_client
from backend.services.llm_service import classify_dump
from backend.services.bucket_service import write_to_bucket

logger = logging.getLogger(__name__)
supabase = get_supabase_client()

BUCKET_INFO = {
    "tasks": {"icon": "✅", "name": "Tasks", "confirmation": "Got it. Added to your tasks."},
    "ideas": {"icon": "💡", "name": "Ideas", "confirmation": "Saved to Ideas. Love it."},
    "journals": {"icon": "📓", "name": "Journal", "confirmation": "Got it. Added to your journal."},
    "finance": {"icon": "💰", "name": "Finance", "confirmation": "Got it. Added to your finances."},
    "health": {"icon": "❤️", "name": "Health", "confirmation": "Got it. Saved to Health."},
    "watchlist": {"icon": "🎬", "name": "Watchlist", "confirmation": "Got it. Added to your Watchlist."},
    "others": {"icon": "📦", "name": "Others", "confirmation": "Saved to Others. Tap to move it if needed."}
}

def format_bucket_tag(bucket_key: str) -> str:
    info = BUCKET_INFO.get(bucket_key)
    if info:
        return f"{info['icon']} {info['name']}"
    return f"📦 {bucket_key.capitalize()}"

async def process_user_dump(user_id: str, message_id: str, text: str, current_time_context: Optional[str] = None) -> Dict[str, Any]:
    """
    1. Log message in chat_messages table
    2. Call LLM to split / classify / extract
    3. Save each item to its respective table
    4. Compile response JSON
    """
    try:
        # Step 1: Save the raw message to chat_messages
        message_data = {
            "id": message_id,
            "user_id": user_id,
            "content": text
        }
        supabase.table("chat_messages").insert(message_data).execute()
        
    except Exception as e:
        logger.error(f"Failed to log chat message: {str(e)}", exc_info=True)
        # Continue processing anyway so the user's workflow isn't blocked

    # Step 2: Run LLM classification
    classified_items = await classify_dump(text, user_id, current_time_context)
    
    response_items = []
    
    for item in classified_items:
        primary = item.get("primary_bucket", "others")
        secondary = item.get("secondary_buckets", [])
        extracted = item.get("extracted", {})
        
        # Keep only valid secondary buckets
        secondary = [b for b in secondary if b in BUCKET_INFO and b != primary]
        
        # Step 3: Save to the database
        db_record = await write_to_bucket(
            user_id=user_id,
            dump_id=message_id,
            bucket=primary,
            secondary_buckets=secondary,
            extracted_data=extracted
        )
        
        # Step 4: Construct the response details
        info = BUCKET_INFO.get(primary, BUCKET_INFO["others"])
        confirmation = info["confirmation"]
        
        # Format tags
        bucket_tags = [format_bucket_tag(primary)]
        for sec in secondary:
            bucket_tags.append(format_bucket_tag(sec))
            
        reminder_set = False
        reminder_text = None
        
        # Handle Task Reminders info
        if primary == "tasks" and extracted.get("reminder_required"):
            reminder_set = True
            due_date = extracted.get("due_date")
            due_time = extracted.get("due_time")
            time_str = f" at {due_time}" if due_time else ""
            date_str = f" for {due_date}" if due_date else " tomorrow"
            reminder_text = f"Reminder set{date_str}{time_str}."
            confirmation += f"\n{reminder_text} [Toggle off]"

        # Incorporate the generated DB ID into the response so client can track
        record_id = db_record.get("id") if db_record else None
        
        response_items.append({
            "id": record_id,
            "primary_bucket": primary,
            "secondary_buckets": secondary,
            "bucket_tags": bucket_tags,
            "confirmation_text": confirmation,
            "reminder_set": reminder_set,
            "reminder_text": reminder_text,
            "extracted": extracted
        })
        
    return {
        "success": True,
        "items": response_items
    }
