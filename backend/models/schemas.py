from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import date, time

class ProcessRequest(BaseModel):
    message_id: str
    text: str
    current_time_context: Optional[str] = None

class ExtractedTask(BaseModel):
    title: str
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    reminder_required: bool = False

class ExtractedIdea(BaseModel):
    title: str
    description: Optional[str] = None

class ExtractedJournal(BaseModel):
    journal_date: str # YYYY-MM-DD
    title: str
    content: str
    mood_signal: Optional[str] = "neutral"

class ExtractedFinance(BaseModel):
    description: str
    amount: float
    currency: str = "INR"
    category: str
    is_settled: bool = False

class ExtractedHealth(BaseModel):
    title: str
    description: str
    health_type: str # 'physical', 'mental', 'medical', 'nutrition'

class ExtractedWatchlist(BaseModel):
    title: str
    genre: str
    content_type: Optional[str] = None
    platform: Optional[str] = None
    year_of_launch: Optional[str] = None
    language: Optional[str] = None
    is_watched: bool = False

class ExtractedOthers(BaseModel):
    raw_text: str

class ProcessedItem(BaseModel):
    primary_bucket: str
    secondary_buckets: List[str] = Field(default_factory=list)
    confidence: float
    formatted_text: str
    extracted: Dict[str, Any]

class ProcessResponseItem(BaseModel):
    id: Optional[str] = None
    primary_bucket: str
    secondary_buckets: List[str] = Field(default_factory=list)
    bucket_tags: List[str]
    confirmation_text: str
    reminder_set: bool
    reminder_text: Optional[str] = None
    extracted: Dict[str, Any]

class ProcessResponse(BaseModel):
    success: bool
    items: List[ProcessResponseItem]

class DashboardTaskItem(BaseModel):
    id: str
    title: str
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    is_complete: bool
    reminder_set: bool

class DashboardResponse(BaseModel):
    success: bool
    today_tasks: List[DashboardTaskItem]
    someday_tasks: List[DashboardTaskItem] = []
    overdue_count: int

class BucketItemUpdateRequest(BaseModel):
    # This schema handles any update to bucket items (e.g. inline edit)
    title: Optional[str] = None
    description: Optional[str] = None
    raw_text: Optional[str] = None
    content: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    is_settled: Optional[bool] = None
    is_complete: Optional[bool] = None
    is_watched: Optional[bool] = None
    genre: Optional[str] = None
    health_type: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None

class ReclassifyRequest(BaseModel):
    to_bucket: str
