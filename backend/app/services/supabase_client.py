import threading

from supabase import create_client, Client
from flask import current_app, g

_admin_client: Client | None = None
_admin_lock = threading.Lock()


def get_supabase_client() -> Client:
    """Per-request client using anon key + user JWT for RLS enforcement."""
    if not hasattr(g, "_supabase_client"):
        client = create_client(
            current_app.config["SUPABASE_URL"],
            current_app.config["SUPABASE_ANON_KEY"],
        )
        if hasattr(g, "user_token"):
            client.postgrest.auth(g.user_token)
        g._supabase_client = client
    return g._supabase_client


def get_supabase_admin_client() -> Client:
    """Admin client using service role key. Bypasses RLS -- use sparingly.

    Thread-safe singleton since the admin client has no per-request state.
    """
    global _admin_client
    if _admin_client is None:
        with _admin_lock:
            if _admin_client is None:
                _admin_client = create_client(
                    current_app.config["SUPABASE_URL"],
                    current_app.config["SUPABASE_SERVICE_ROLE_KEY"],
                )
    return _admin_client
