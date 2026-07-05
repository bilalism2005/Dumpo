from supabase import create_client, Client
from backend.config import settings

# Create a Supabase Client with Service Key for backend operations
# This client can bypass RLS since it uses the Service Role Key, 
# but we must ensure we enforce user_id constraints on all operations.
supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

def get_supabase_client() -> Client:
    return supabase_client
