import threading

from supabase import create_client, Client
from flask import current_app

_client: Client | None = None
_lock = threading.Lock()


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = create_client(
                    current_app.config["SUPABASE_URL"],
                    current_app.config["SUPABASE_SERVICE_ROLE_KEY"],
                )
    return _client
