"""OpenRouter (OpenAI-compatible API) for mistake analysis and vision coords."""

import os
from functools import lru_cache

from openai import OpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def is_openrouter_mistake_backend() -> bool:
    backend = (os.getenv("MISTAKE_ANALYSIS_BACKEND", "anthropic") or "anthropic").strip().lower()
    return backend in ("openrouter", "open_router")


def default_openrouter_model() -> str:
    return (
        os.getenv("MISTAKE_ANALYSIS_OPENROUTER_MODEL")
        or os.getenv("MISTAKE_ANALYSIS_MODEL")
        or "anthropic/claude-sonnet-4"
    ).strip()


def normalize_openrouter_model(model: str) -> str:
    m = (model or "").strip()
    if not m:
        return default_openrouter_model()
    if "/" in m:
        return m
    if m.startswith("claude-"):
        return f"anthropic/{m}"
    if m.startswith("gpt-"):
        return f"openai/{m}"
    return m


@lru_cache(maxsize=1)
def get_openrouter_client() -> OpenAI:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")
    base = (os.getenv("OPENROUTER_BASE_URL") or OPENROUTER_BASE_URL).strip()
    return OpenAI(api_key=api_key, base_url=base)
