import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

ARTIFACTS_BUCKET = "veridian-artifacts"


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    anon_key: str
    service_role_key: str
    artifacts_bucket: str
    signed_url_ttl_seconds: int
    artifacts_table: str
    coord_runs_table: str


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@lru_cache(maxsize=1)
def get_supabase_settings() -> SupabaseSettings:
    configured_bucket = os.getenv("SUPABASE_ARTIFACTS_BUCKET", "").strip()
    if configured_bucket and configured_bucket != ARTIFACTS_BUCKET:
        raise RuntimeError(
            "SUPABASE_ARTIFACTS_BUCKET overrides are not supported. "
            f"Use '{ARTIFACTS_BUCKET}' to match storage policies."
        )

    return SupabaseSettings(
        url=_required_env("SUPABASE_URL"),
        anon_key=_required_env("SUPABASE_ANON_KEY"),
        service_role_key=_required_env("SUPABASE_SERVICE_ROLE_KEY"),
        artifacts_bucket=ARTIFACTS_BUCKET,
        signed_url_ttl_seconds=int(os.getenv("SUPABASE_SIGNED_URL_TTL_SECONDS", "3600")),
        artifacts_table=os.getenv("SUPABASE_ARTIFACTS_TABLE", "veridian_artifacts").strip() or "veridian_artifacts",
        coord_runs_table=os.getenv("SUPABASE_COORD_RUNS_TABLE", "veridian_mistake_coord_runs").strip()
        or "veridian_mistake_coord_runs",
    )


@lru_cache(maxsize=1)
def get_supabase_service_client() -> Client:
    settings = get_supabase_settings()
    return create_client(settings.url, settings.service_role_key)


@lru_cache(maxsize=1)
def get_supabase_auth_client() -> Client:
    settings = get_supabase_settings()
    return create_client(settings.url, settings.anon_key)


def unwrap_supabase_data(response: Any) -> Any:
    if response is None:
        return None

    if isinstance(response, dict):
        error = response.get("error")
        if error:
            raise RuntimeError(str(error))
        return response.get("data", response)

    error = getattr(response, "error", None)
    if error:
        raise RuntimeError(str(error))

    data = getattr(response, "data", None)
    if data is not None:
        return data

    if hasattr(response, "model_dump"):
        dumped = response.model_dump()
        if isinstance(dumped, dict) and dumped.get("error"):
            raise RuntimeError(str(dumped["error"]))
        return dumped.get("data", dumped) if isinstance(dumped, dict) else dumped

    return response
