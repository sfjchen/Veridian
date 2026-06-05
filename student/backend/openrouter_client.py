"""OpenRouter (OpenAI-compatible API) for LLM calls."""

import os
from functools import lru_cache
from typing import Any

from openai import OpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _backend_flag(name: str, default: str = "anthropic") -> str:
    return (os.getenv(name) or os.getenv("LLM_BACKEND") or default).strip().lower()


def is_openrouter_backend(scope: str) -> bool:
    """scope: mistake | chat | ocr"""
    key = {
        "mistake": "MISTAKE_ANALYSIS_BACKEND",
        "chat": "CHAT_BACKEND",
        "ocr": "MATH_OCR_BACKEND",
    }[scope]
    backend = _backend_flag(key)
    if backend in ("openrouter", "open_router"):
        return True
    if backend in ("anthropic", "openai"):
        return False
    # default: openrouter when key is set
    if os.getenv("OPENROUTER_API_KEY", "").strip():
        return True
    return False


def is_openrouter_mistake_backend() -> bool:
    return is_openrouter_backend("mistake")


def is_openrouter_chat_backend() -> bool:
    return is_openrouter_backend("chat")


def is_openrouter_ocr_backend() -> bool:
    return is_openrouter_backend("ocr")


def default_openrouter_model() -> str:
    return (
        os.getenv("MISTAKE_ANALYSIS_OPENROUTER_MODEL")
        or os.getenv("MISTAKE_ANALYSIS_MODEL")
        or "anthropic/claude-sonnet-4"
    ).strip()


def chat_openrouter_model() -> str:
    return normalize_openrouter_model(
        os.getenv("CHAT_OPENROUTER_MODEL")
        or os.getenv("CHAT_MODEL")
        or "anthropic/claude-sonnet-4"
    )


def ocr_openrouter_model() -> str:
    return normalize_openrouter_model(
        os.getenv("MATH_OCR_OPENROUTER_MODEL")
        or os.getenv("MATH_OCR_MODEL")
        or "google/gemini-2.0-flash-001"
    )


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
    if m.startswith("gemini-"):
        return f"google/{m}"
    return m


@lru_cache(maxsize=1)
def get_openrouter_client() -> OpenAI:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")
    base = (os.getenv("OPENROUTER_BASE_URL") or OPENROUTER_BASE_URL).strip()
    default_headers: dict[str, str] = {}
    referer = (os.getenv("OPENROUTER_HTTP_REFERER") or "https://www.veridian.fyi").strip()
    title = (os.getenv("OPENROUTER_APP_TITLE") or "Veridian Whiteboard").strip()
    if referer:
        default_headers["HTTP-Referer"] = referer
    if title:
        default_headers["X-Title"] = title
    return OpenAI(api_key=api_key, base_url=base, default_headers=default_headers or None)


def openrouter_chat_completion(
    *,
    model: str,
    messages: list[dict[str, Any]],
    max_tokens: int,
    temperature: float | None = None,
) -> str:
    kwargs: dict[str, Any] = {
        "model": normalize_openrouter_model(model),
        "messages": messages,
        "max_completion_tokens": max_tokens,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    response = get_openrouter_client().chat.completions.create(**kwargs)
    content = (response.choices[0].message.content or "").strip()
    if not content:
        raise RuntimeError("OpenRouter returned empty response")
    return content
