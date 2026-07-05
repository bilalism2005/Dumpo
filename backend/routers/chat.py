from fastapi import APIRouter, Depends, HTTPException, status
from backend.models.schemas import ProcessRequest, ProcessResponse
from backend.routers.auth import get_current_user_id
from backend.services.classification_service import process_user_dump

router = APIRouter(prefix="/api/v1", tags=["chat"])

@router.post("/process", response_model=ProcessResponse)
async def process_dump(
    payload: ProcessRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Process a new raw thought dump.
    """
    if not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dump text cannot be empty."
        )
        
    try:
        response_data = process_user_dump(
            user_id=user_id,
            message_id=payload.message_id,
            text=payload.text
        )
        return response_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process dump: {str(e)}"
        )
