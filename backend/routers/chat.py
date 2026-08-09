import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from backend.models.schemas import ProcessRequest, ProcessResponse
from backend.routers.auth import get_current_user_id
from backend.services.graph_service import process_user_dump_graph
from backend.services.supabase_service import get_supabase_client
from backend.services.llm_service import client

router = APIRouter(prefix="/api/v1", tags=["chat"])
supabase = get_supabase_client()

@router.post("/process", response_model=ProcessResponse)
async def process_dump(
    payload: ProcessRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Process a new raw thought dump using LangGraph.
    """
    if not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dump text cannot be empty."
        )
        
    try:
        response_data = await process_user_dump_graph(
            user_id=user_id,
            message_id=payload.message_id,
            text=payload.text,
            current_time_context=payload.current_time_context
        )
        return response_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process dump: {str(e)}"
        )

@router.get("/chat/history")
async def get_chat_history(
    user_id: str = Depends(get_current_user_id)
):
    """
    Fetch raw chat messages and assistant replies directly from the unified chat_messages log.
    """
    try:
        res = supabase.table("chat_messages")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=False)\
            .execute()
        messages = res.data if res.data else []
        return {"success": True, "messages": messages}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch chat history: {str(e)}"
        )

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Transcribe audio file to text using Groq Whisper API (whisper-large-v3).
    """
    try:
        content = await file.read()
        file_tuple = (file.filename or "audio.m4a", content, file.content_type or "audio/m4a")
        
        loop = asyncio.get_running_loop()
        transcription = await loop.run_in_executor(
            None,
            lambda: client.audio.transcriptions.create(
                file=file_tuple,
                model="whisper-large-v3"
            )
        )
        text = transcription.text.strip() if hasattr(transcription, "text") else str(transcription)
        return {"success": True, "text": text}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transcribe audio: {str(e)}"
        )

