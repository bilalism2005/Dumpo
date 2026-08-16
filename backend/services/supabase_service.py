from supabase import create_client, Client, ClientOptions
from backend.config import settings

# Global Service Client (Bypasses RLS - use ONLY for backend system tasks)
supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

def get_supabase_client() -> Client:
    """Returns the global service client. Bypasses RLS."""
    return supabase_client

def get_user_supabase_client(token: str) -> Client:
    """
    Returns a per-request Supabase client instantiated with the user's JWT.
    This natively enforces PostgreSQL Row Level Security (RLS) on all operations.
    """
    options = ClientOptions(headers={'Authorization': f'Bearer {token}'})
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY, options=options)
