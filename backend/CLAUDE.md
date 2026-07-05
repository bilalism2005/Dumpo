# Dumpo Backend Guidelines

## Commands
* Run server locally: `uvicorn backend.main:app --reload`
* Run tests: `pytest`
* Run test with output: `pytest -s`

## Directory Structure
* `routers/`: FastAPI HTTP routers (chat, dashboard, items, auth)
* `services/`: Business logic layer (llm_service, supabase_service, classification_service, bucket_service)
* `models/`: Pydantic data schemas (schemas)

## Design Patterns & Rules
1. **Try/Catch Everywhere**: Every single endpoint, service function, and query must be wrapped in a try/catch block. Exceptions should never crash the server; default/fallback behaviors (like routing to the "others" bucket) must be executed.
2. **Never commit secrets**: Keep all credentials in the root `.env` file (loaded via config.py).
3. **No direct Supabase queries in routers**: Business logic and database mutations reside in `services/`.
4. **Token extraction**: Always extract the `user_id` from the decoded JWT Bearer token. Never trust any user_id passed in HTTP request bodies.
5. **No markdown in Groq responses**: Groq prompts must strictly request raw, parsable JSON without markdown annotations (like ` ```json `).
6. **No delete buttons**: Items are deleted only by clearing their text contents (or using the direct deletion endpoint when fields are blank).
