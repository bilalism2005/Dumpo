import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.routers.auth import get_current_user_id
from backend.services.supabase_service import get_supabase_client
from backend.models.schemas import BucketItemUpdateRequest, ReclassifyRequest

router = APIRouter(prefix="/api/v1", tags=["items"])
supabase = get_supabase_client()
logger = logging.getLogger(__name__)

# List of all primary bucket tables
BUCKET_TABLES = ["tasks", "ideas", "journals", "finance", "health", "watchlist", "others"]

@router.get("/buckets/{bucket_name}")
async def get_bucket_items(
    bucket_name: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Fetch all items belonging to a specific bucket.
    Includes items where the bucket is the primary table,
    plus items where the bucket is in secondary_buckets of other tables.
    """
    if bucket_name not in BUCKET_TABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid bucket name: {bucket_name}"
        )
        
    try:
        combined_items = []
        
        # 1. Fetch from the primary table of this bucket
        primary_res = supabase.table(bucket_name).select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        if primary_res.data:
            for row in primary_res.data:
                row["source_table"] = bucket_name
                row["is_primary"] = True
                combined_items.append(row)
                
        # 2. Fetch from other tables where this bucket is in secondary_buckets
        for other_table in BUCKET_TABLES:
            if other_table == bucket_name or other_table == "others":
                # 'others' doesn't have secondary_buckets
                continue
                
            secondary_res = supabase.table(other_table)\
                .select("*")\
                .eq("user_id", user_id)\
                .contains("secondary_buckets", [bucket_name])\
                .execute()
                
            if secondary_res.data:
                for row in secondary_res.data:
                    row["source_table"] = other_table
                    row["is_primary"] = False
                    combined_items.append(row)
                    
        # Sort combined list by created_at desc (or custom sorting depending on bucket type)
        combined_items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "success": True,
            "bucket": bucket_name,
            "items": combined_items
        }
        
    except Exception as e:
        logger.error(f"Error fetching items for bucket {bucket_name}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch bucket items: {str(e)}"
        )

@router.patch("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    is_complete: Optional[bool] = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Toggle task completion.
    """
    try:
        # Get existing task status
        existing = supabase.table("tasks").select("is_complete").eq("id", task_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Task not found")
            
        current_status = existing.data[0]["is_complete"]
        new_status = is_complete if is_complete is not None else not current_status
        completed_at = datetime.now().isoformat() if new_status else None
        
        res = supabase.table("tasks").update({
            "is_complete": new_status,
            "completed_at": completed_at
        }).eq("id", task_id).eq("user_id", user_id).execute()
        
        return {"success": True, "task": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/tasks/{task_id}/reminder")
async def toggle_task_reminder(
    task_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Toggle task reminder_set flag on/off.
    """
    try:
        existing = supabase.table("tasks").select("reminder_set").eq("id", task_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Task not found")
            
        new_val = not existing.data[0]["reminder_set"]
        res = supabase.table("tasks").update({"reminder_set": new_val}).eq("id", task_id).eq("user_id", user_id).execute()
        return {"success": True, "task": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/watchlist/{item_id}/toggle")
async def toggle_watchlist_watched(
    item_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Toggle watchlist is_watched flag on/off.
    """
    try:
        existing = supabase.table("watchlist").select("is_watched").eq("id", item_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Watchlist item not found")
            
        new_val = not existing.data[0]["is_watched"]
        watched_at = datetime.now().isoformat() if new_val else None
        res = supabase.table("watchlist").update({
            "is_watched": new_val,
            "watched_at": watched_at
        }).eq("id", item_id).eq("user_id", user_id).execute()
        return {"success": True, "item": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/finance/{item_id}/settle")
async def toggle_finance_settled(
    item_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Toggle finance item is_settled flag on/off (Pay/Receive categories).
    """
    try:
        existing = supabase.table("finance").select("is_settled").eq("id", item_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Finance entry not found")
            
        new_val = not existing.data[0]["is_settled"]
        settled_at = datetime.now().isoformat() if new_val else None
        res = supabase.table("finance").update({
            "is_settled": new_val,
            "settled_at": settled_at
        }).eq("id", item_id).eq("user_id", user_id).execute()
        return {"success": True, "item": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/items/{bucket}/{item_id}")
async def update_item_content(
    bucket: str,
    item_id: str,
    payload: BucketItemUpdateRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update item content inline.
    If all main text fields are erased, deletes the item.
    """
    if bucket not in BUCKET_TABLES:
        raise HTTPException(status_code=400, detail="Invalid bucket table")
        
    # Check if we should delete (i.e. all text inputs empty/erased)
    should_delete = False
    
    if bucket == "tasks" and payload.title == "":
        should_delete = True
    elif bucket == "ideas" and payload.title == "" and payload.description == "":
        should_delete = True
    elif bucket == "journals" and payload.content == "":
        should_delete = True
    elif bucket == "finance" and payload.description == "":
        should_delete = True
    elif bucket == "health" and payload.description == "" and payload.title == "":
        should_delete = True
    elif bucket == "watchlist" and payload.title == "":
        should_delete = True
    elif bucket == "others" and payload.raw_text == "":
        should_delete = True
        
    if should_delete:
        try:
            supabase.table(bucket).delete().eq("id", item_id).eq("user_id", user_id).execute()
            return {"success": True, "deleted": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete item: {str(e)}")
            
    # Regular Update
    update_data = {}
    
    # Filter only relevant fields passed in payload
    fields_map = {
        "tasks": ["title", "due_date", "due_time", "is_complete"],
        "ideas": ["title", "description"],
        "journals": ["title", "content"],
        "finance": ["description", "amount", "category", "is_settled"],
        "health": ["title", "description", "health_type"],
        "watchlist": ["title", "genre", "is_watched"],
        "others": ["raw_text"]
    }
    
    allowed_fields = fields_map.get(bucket, [])
    payload_dict = payload.model_dump(exclude_unset=True)
    
    for k, v in payload_dict.items():
        if k in allowed_fields:
            update_data[k] = v
            
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid update parameters provided")
        
    try:
        res = supabase.table(bucket).update(update_data).eq("id", item_id).eq("user_id", user_id).execute()
        return {"success": True, "item": res.data[0] if res.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/items/{bucket}/{item_id}")
async def delete_item(
    bucket: str,
    item_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Explicit delete endpoint.
    """
    if bucket not in BUCKET_TABLES:
        raise HTTPException(status_code=400, detail="Invalid bucket table")
        
    try:
        supabase.table(bucket).delete().eq("id", item_id).eq("user_id", user_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/items/{bucket}/{item_id}/reclassify")
async def reclassify_item(
    bucket: str,
    item_id: str,
    payload: ReclassifyRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Reclassify an item to a different bucket.
    Logs reclassification in bucket_changes.
    Transfers the database record from the source table to target table.
    """
    from_bucket = bucket
    to_bucket = payload.to_bucket
    
    if from_bucket not in BUCKET_TABLES or to_bucket not in BUCKET_TABLES:
        raise HTTPException(status_code=400, detail="Invalid bucket name(s)")
        
    if from_bucket == to_bucket:
        return {"success": True, "message": "Item is already in the target bucket"}
        
    try:
        # 1. Fetch item from source table
        source_res = supabase.table(from_bucket).select("*").eq("id", item_id).eq("user_id", user_id).execute()
        if not source_res.data:
            raise HTTPException(status_code=404, detail="Item not found in source bucket")
            
        item_data = source_res.data[0]
        
        # 2. Map data fields to target table schema
        target_data = {
            "user_id": user_id,
            "dump_id": item_data.get("dump_id"),
            "secondary_buckets": item_data.get("secondary_buckets", [])
        }
        
        # Remove original bucket from secondary buckets if present, add from_bucket
        if from_bucket in target_data["secondary_buckets"]:
            target_data["secondary_buckets"].remove(from_bucket)
            
        # Field mapping logic
        if to_bucket == "tasks":
            target_data["title"] = item_data.get("title") or item_data.get("description") or item_data.get("raw_text") or "Reclassified Task"
            target_data["due_date"] = item_data.get("due_date")
            target_data["due_time"] = item_data.get("due_time")
            target_data["is_complete"] = item_data.get("is_complete") or item_data.get("is_watched") or item_data.get("is_settled") or False
            
        elif to_bucket == "ideas":
            target_data["title"] = item_data.get("title") or item_data.get("description") or item_data.get("raw_text") or "Reclassified Idea"
            target_data["description"] = item_data.get("description") or item_data.get("content") or item_data.get("raw_text")
            
        elif to_bucket == "journals":
            target_data["journal_date"] = item_data.get("journal_date") or datetime.now().date().isoformat()
            target_data["title"] = item_data.get("title") or "Reclassified Journal"
            target_data["content"] = item_data.get("content") or item_data.get("description") or item_data.get("raw_text") or ""
            target_data["mood_signal"] = item_data.get("mood_signal") or "neutral"
            
        elif to_bucket == "finance":
            target_data["description"] = item_data.get("description") or item_data.get("title") or item_data.get("raw_text") or "Reclassified Transaction"
            target_data["amount"] = float(item_data.get("amount") or 0)
            target_data["currency"] = item_data.get("currency") or "INR"
            target_data["category"] = item_data.get("category") or "others"
            target_data["is_settled"] = item_data.get("is_settled") or False
            
        elif to_bucket == "health":
            target_data["title"] = item_data.get("title") or "Reclassified Health item"
            target_data["description"] = item_data.get("description") or item_data.get("content") or item_data.get("raw_text") or ""
            target_data["health_type"] = item_data.get("health_type") or "physical"
            
        elif to_bucket == "watchlist":
            target_data["title"] = item_data.get("title") or item_data.get("description") or item_data.get("raw_text") or "Reclassified Watchlist item"
            target_data["genre"] = item_data.get("genre") or "others"
            target_data["is_watched"] = item_data.get("is_watched") or False
            
        elif to_bucket == "others":
            target_data["raw_text"] = item_data.get("raw_text") or item_data.get("description") or item_data.get("content") or item_data.get("title") or ""

        # 3. Write target item
        target_res = supabase.table(to_bucket).insert(target_data).execute()
        if not target_res.data:
            raise HTTPException(status_code=500, detail="Failed to write item to target bucket")
            
        new_item_id = target_res.data[0]["id"]
        
        # 4. Delete source item
        supabase.table(from_bucket).delete().eq("id", item_id).eq("user_id", user_id).execute()
        
        # 5. Log change in bucket_changes
        change_log = {
            "user_id": user_id,
            "item_id": new_item_id,
            "from_bucket": from_bucket,
            "to_bucket": to_bucket
        }
        supabase.table("bucket_changes").insert(change_log).execute()
        
        return {
            "success": True,
            "new_id": new_item_id,
            "item": target_res.data[0]
        }
        
    except Exception as e:
        logger.error(f"Failed to reclassify item {item_id} from {from_bucket} to {to_bucket}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reclassification failed: {str(e)}")
