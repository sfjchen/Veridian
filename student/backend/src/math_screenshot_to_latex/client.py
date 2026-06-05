"""Math screenshot → LaTeX via OpenAI or OpenRouter vision."""

import base64
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

from openai import OpenAI

from .models import IMAGE_DETAIL, MODEL, PROMPT

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


@lru_cache(maxsize=1)
def _get_openai_client() -> OpenAI:
    return OpenAI()


def _strip_fences(raw: str) -> str:
    s = raw.strip()
    m = re.search(r"^```(?:latex|tex)?\s*\n?(.*?)\n?```\s*$", s, re.DOTALL)
    return m.group(1).strip() if m else s


def _vision_messages(mime_type: str, image_bytes: bytes, detail: str) -> list[dict]:
    url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    return [{
        "role": "user",
        "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": url, "detail": detail}},
        ],
    }]


def _image_bytes_to_latex_impl(
    image_bytes: bytes,
    mime_type: str,
    model: str = MODEL,
    detail: str = IMAGE_DETAIL,
) -> str:
    from openrouter_client import is_openrouter_ocr_backend, get_openrouter_client, ocr_openrouter_model

    messages = _vision_messages(mime_type, image_bytes, detail)
    if is_openrouter_ocr_backend():
        or_model = ocr_openrouter_model() if model == MODEL else model
        if "/" not in or_model:
            from openrouter_client import normalize_openrouter_model
            or_model = normalize_openrouter_model(or_model)
        resp = get_openrouter_client().chat.completions.create(
            model=or_model,
            max_completion_tokens=1024,
            messages=messages,
        )
        return _strip_fences(resp.choices[0].message.content or "")

    kwargs = {
        "model": model,
        "messages": messages,
    }
    kwargs["max_completion_tokens" if model.startswith("gpt-5") else "max_tokens"] = 1024
    resp = _get_openai_client().chat.completions.create(**kwargs)
    return _strip_fences(resp.choices[0].message.content or "")


def screenshot_to_latex(
    image_path: Optional[str | Path] = None,
    *,
    image_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    model: str = MODEL,
    detail: str = IMAGE_DETAIL,
) -> str:
    """Convert math screenshot to LaTeX. Uses OpenRouter when MATH_OCR_BACKEND=openrouter."""
    if image_bytes is not None and mime_type is not None:
        return _image_bytes_to_latex_impl(image_bytes, mime_type, model=model, detail=detail)
    if image_path is None:
        raise ValueError("Provide image_path or (image_bytes, mime_type)")
    path = Path(image_path)
    with open(path, "rb") as f:
        data = f.read()
    mime = MIME.get(path.suffix.lower(), "image/png")
    return _image_bytes_to_latex_impl(data, mime, model=model, detail=detail)
