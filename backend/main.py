import time
import logging
from collections import defaultdict
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from backend.routers import chat, dashboard, items

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Dumpo API",
    description="AI-powered mobile productivity app backend",
    version="1.0.0"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

# CORS setup for mobile/web local connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple In-Memory Rate Limiter: 60 requests per minute per user (or client IP)
# Structure: { client_key: [timestamps] }
rate_limit_records = defaultdict(list)
RATE_LIMIT_MAX = 60
RATE_LIMIT_WINDOW = 60.0 # seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exclude health check from rate limiting
    if request.url.path == "/api/health":
        return await call_next(request)

    # Use Authorization header value (user token) or fallback to client IP
    auth_header = request.headers.get("Authorization", "")
    client_key = auth_header if auth_header else request.client.host
    
    current_time = time.time()
    
    # Filter out timestamps older than the rate limit window
    timestamps = rate_limit_records[client_key]
    rate_limit_records[client_key] = [t for t in timestamps if current_time - t < RATE_LIMIT_WINDOW]
    
    if len(rate_limit_records[client_key]) >= RATE_LIMIT_MAX:
        logger.warning(f"Rate limit exceeded for key: {client_key[:20]}...")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 60 requests per minute allowed."
        )
        
    rate_limit_records[client_key].append(current_time)
    
    # Execute request
    response = await call_next(request)
    return response

# Register Routers
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(items.router)

@app.get("/api/health", tags=["health"])
async def health_check():
    """
    Public health check endpoint. No authentication required.
    """
    return {"status": "ok", "timestamp": time.time()}
