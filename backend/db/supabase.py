"""
Supabase client initialisation for InvestiGraph AI.

We use the SERVICE ROLE key (not the anon key) because the backend
needs to bypass Row Level Security (RLS) when performing operations
on behalf of authenticated users — for example, inserting entities
discovered by the AI agents into a user's project.

The anon key is used only by the frontend (via Supabase Auth JS SDK)
for client-side authentication flows.

Security Note:
  The service role key must NEVER be exposed to the frontend.
  It is loaded from the environment and used only server-side.
"""

import logging
from supabase import create_client, Client
from config import get_settings

logger = logging.getLogger(__name__)


def _init_supabase_client() -> Client:
    """
    Create and return a Supabase client using the service role key.
    
    This function is called once at module level. The resulting client
    is reused across the entire application to avoid creating multiple
    connections.
    
    Returns:
        Client: Configured Supabase client instance.
    
    Raises:
        Exception: If SUPABASE_URL or SUPABASE_SERVICE_KEY are invalid.
    """
    settings = get_settings()
    logger.info(f"Initialising Supabase client for: {settings.SUPABASE_URL}")
    
    client = create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_KEY,
    )
    
    logger.info("Supabase client initialised successfully")
    return client


# Singleton client instance — import this from anywhere in the backend
supabase: Client = _init_supabase_client()
