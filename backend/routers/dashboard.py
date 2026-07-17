from fastapi import APIRouter, Depends, Query
from datetime import datetime
from typing import List, Optional
from backend.routers.auth import get_current_user_id
from backend.services.supabase_service import get_supabase_client

router = APIRouter(prefix="/api/v1", tags=["dashboard"])
supabase = get_supabase_client()

@router.get("/dashboard")
async def get_dashboard(
    current_date: Optional[str] = Query(None, description="Local date of client in YYYY-MM-DD format"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get dashboard data (today's tasks + overdue count).
    """
    if not current_date:
        current_date = datetime.now().date().isoformat()
        
    try:
        # Fetch today's tasks (both complete and incomplete)
        today_tasks_res = supabase.table("tasks")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("due_date", current_date)\
            .order("created_at", desc=False)\
            .execute()

        # Fetch someday tasks (both complete and incomplete)
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
            
        today_tasks = today_tasks_res.data if today_tasks_res.data else []
        someday_tasks = someday_tasks_res.data if someday_tasks_res.data else []
        overdue_tasks = overdue_tasks_res.data if overdue_tasks_res.data else []
        
        return {
            "success": True,
            "today_tasks": today_tasks,
            "someday_tasks": someday_tasks,
            "overdue_tasks": overdue_tasks,
            "overdue_count": len(overdue_tasks)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "today_tasks": [],
            "overdue_tasks": [],
            "overdue_count": 0
        }
