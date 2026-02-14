from supabase import create_client, Client
from flask import current_app, g


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
    """Per-request admin client using service role key. Bypasses RLS.

    Created fresh per request to avoid HTTP/2 connection resets from the
    Supabase server terminating idle pooled connections.
    """
    if not hasattr(g, "_supabase_admin_client"):
        g._supabase_admin_client = create_client(
            current_app.config["SUPABASE_URL"],
            current_app.config["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return g._supabase_admin_client
