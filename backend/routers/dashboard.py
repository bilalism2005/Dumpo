from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime
from typing import List, Optional
from backend.routers.auth import get_current_user_id
from backend.services.supabase_service import get_supabase_client

router = APIRouter(prefix="/api/v1", tags=["dashboard"])
supabase = get_supabase_client()

def is_completed_on_prior_day(task: dict, current_date_str: str) -> bool:
    if not task.get("is_complete"):
        return False
    completed_at = task.get("completed_at")
    if completed_at:
        completed_date = str(completed_at)[:10]
        if completed_date < current_date_str:
            return True
    return False

@router.get("/dashboard")
async def get_dashboard(
    current_date: Optional[str] = Query(None, description="Local date of client in YYYY-MM-DD format"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get dashboard data (today's tasks, someday tasks, overdue count, ideas preview, journals preview).
    """
    if not current_date:
        current_date = datetime.now().date().isoformat()
        
    try:
        # Fetch today's tasks
        today_tasks_res = supabase.table("tasks")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("due_date", current_date)\
            .order("created_at", desc=False)\
            .execute()

        # Fetch someday tasks
        someday_tasks_res = supabase.table("tasks")\
            .select("*")\
            .eq("user_id", user_id)\
            .is_("due_date", "null")\
            .execute()
            
        # Fetch overdue tasks (incomplete only, due before today)
        overdue_tasks_res = supabase.table("tasks")\
            .select("*")\
            .eq("user_id", user_id)\
            .lt("due_date", current_date)\
            .eq("is_complete", False)\
            .order("due_date", desc=False)\
            .execute()

        # Fetch ideas preview
        ideas_res = supabase.table("ideas")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()

        # Fetch journals preview
        journals_res = supabase.table("journals")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()
            
        today_tasks_raw = today_tasks_res.data if today_tasks_res.data else []
        someday_tasks_raw = someday_tasks_res.data if someday_tasks_res.data else []
        overdue_tasks = overdue_tasks_res.data if overdue_tasks_res.data else []
        ideas_preview = ideas_res.data if ideas_res.data else []
        journals_preview = journals_res.data if journals_res.data else []
        
        # Filter out tasks completed on prior days so daily progress resets at midnight
        today_tasks = [t for t in today_tasks_raw if not is_completed_on_prior_day(t, current_date)]
        someday_tasks = [t for t in someday_tasks_raw if not is_completed_on_prior_day(t, current_date)]
        
        return {
            "success": True,
            "today_tasks": today_tasks,
            "someday_tasks": someday_tasks,
            "overdue_tasks": overdue_tasks,
            "overdue_count": len(overdue_tasks),
            "ideas_preview": ideas_preview,
            "journals_preview": journals_preview
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
