from fastapi import Header, HTTPException, status, Depends
from typing import Optional
from backend.services.supabase_service import get_supabase_client

supabase = get_supabase_client()

async def get_current_user_id(authorization: Optional[str] = Header(None, description="Bearer token from Supabase Auth")) -> str:
    """
    FastAPI dependency to verify Supabase JWT token and extract the user_id.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
        
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Must start with 'Bearer '"
        )
        
    token = authorization.split(" ")[1]
    
    try:
        # Call Supabase Auth API to get the user from JWT
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or user not found"
            )
        return user_response.user.id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )
