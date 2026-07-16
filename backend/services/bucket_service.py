import logging
from typing import Dict, Any, List
from datetime import datetime
from backend.services.supabase_service import get_supabase_client
from backend.services.llm_service import merge_journals_narrative

logger = logging.getLogger(__name__)
supabase = get_supabase_client()

def write_to_bucket(
    user_id: str,
    dump_id: str,
    bucket: str,
    secondary_buckets: List[str],
    extracted_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Write classified structured data to the respective database table.
    Handles same-day merge for journals and table-specific fields.
    """
    try:
        if bucket == "tasks":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "title": extracted_data.get("title", "Untitled Task"),
                "due_date": extracted_data.get("due_date"),
                "due_time": extracted_data.get("due_time"),
                "reminder_set": extracted_data.get("reminder_required", False),
                "secondary_buckets": secondary_buckets
            }
            res = supabase.table("tasks").insert(data).execute()
            return res.data[0] if res.data else {}

        elif bucket == "ideas":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "title": extracted_data.get("title", "Untitled Idea"),
                "description": extracted_data.get("description"),
                "secondary_buckets": secondary_buckets
            }
            res = supabase.table("ideas").insert(data).execute()
            return res.data[0] if res.data else {}

        elif bucket == "journals":
            journal_date = extracted_data.get("journal_date")
            if not journal_date:
                journal_date = datetime.now().date().isoformat()
            
            # Check for existing journal for the same day
            existing = supabase.table("journals").select("*").eq("user_id", user_id).eq("journal_date", journal_date).execute()
            
            if existing.data:
                # Merge existing journal with new journal dump
                old_entry = existing.data[0]
                merged_content = merge_journals_narrative(old_entry.get("content", ""), extracted_data.get("content", ""), journal_date)
                # Combine secondary buckets
                new_sec = list(set(old_entry.get("secondary_buckets", []) + secondary_buckets))
                
                update_data = {
                    "content": merged_content,
                    "secondary_buckets": new_sec,
                    "title": extracted_data.get("title", old_entry.get("title", "Combined Journal")),
                    "mood_signal": extracted_data.get("mood_signal", old_entry.get("mood_signal", "neutral")),
                    "dump_id": dump_id # Link to most recent dump
                }
                
                res = supabase.table("journals").update(update_data).eq("id", old_entry["id"]).execute()
                return res.data[0] if res.data else {}
            else:
                data = {
                    "user_id": user_id,
                    "dump_id": dump_id,
                    "journal_date": journal_date,
                    "title": extracted_data.get("title", "Daily Log"),
                    "content": extracted_data.get("content", ""),
                    "mood_signal": extracted_data.get("mood_signal", "neutral"),
                    "secondary_buckets": secondary_buckets
                }
                res = supabase.table("journals").insert(data).execute()
                return res.data[0] if res.data else {}

        elif bucket == "finance":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "description": extracted_data.get("description", "Unspecified Transaction"),
                "amount": float(extracted_data.get("amount", 0)),
                "currency": extracted_data.get("currency", "INR"),
                "category": extracted_data.get("category", "others"),
                "is_settled": extracted_data.get("is_settled", False),
                "secondary_buckets": secondary_buckets
            }
            res = supabase.table("finance").insert(data).execute()
            return res.data[0] if res.data else {}

        elif bucket == "health":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "title": extracted_data.get("title", "Health Update"),
                "description": extracted_data.get("description", ""),
                "health_type": extracted_data.get("health_type", "physical"),
                "secondary_buckets": secondary_buckets
            }
            res = supabase.table("health").insert(data).execute()
            return res.data[0] if res.data else {}

        elif bucket == "watchlist":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "title": extracted_data.get("title", "Untitled watch item"),
                "genre": extracted_data.get("genre", "others"),
                "content_type": extracted_data.get("content_type"),
                "platform": extracted_data.get("platform"),
                "year_of_launch": extracted_data.get("year_of_launch"),
                "language": extracted_data.get("language"),
                "is_watched": extracted_data.get("is_watched", False),
                "secondary_buckets": secondary_buckets
            }
            res = supabase.table("watchlist").insert(data).execute()
            return res.data[0] if res.data else {}

        elif bucket == "others":
            data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "raw_text": extracted_data.get("raw_text", "")
            }
            res = supabase.table("others").insert(data).execute()
            return res.data[0] if res.data else {}
            
        else:
            raise ValueError(f"Unknown bucket type: {bucket}")
            
    except Exception as e:
        logger.error(f"Error writing to bucket {bucket} for user {user_id}: {str(e)}", exc_info=True)
        # Fallback: write raw text to Others table
        try:
            fallback_data = {
                "user_id": user_id,
                "dump_id": dump_id,
                "raw_text": str(extracted_data)
            }
            res = supabase.table("others").insert(fallback_data).execute()
            return res.data[0] if res.data else {}
        except Exception as fe:
            logger.error(f"Fallback write to others failed: {str(fe)}")
            return {}
