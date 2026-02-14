import base64
import anthropic
from flask import current_app

# Claude API PDF input limit; also keeps memory usage reasonable per request
MAX_FILE_SIZE = 10 * 1024 * 1024


def convert_pdf_to_latex(pdf_bytes: bytes) -> str:
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit")

    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    message = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=8192,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_b64,
                    },
                },
                {
                    "type": "text",
                    "text": "Convert this PDF to LaTeX. Return ONLY the LaTeX content — no explanation, no markdown code fences. Preserve all mathematical notation, formatting, and structure as faithfully as possible.",
                },
            ],
        }],
    )
    if not message.content:
        raise ValueError("Claude API returned empty response")
    block = message.content[0]
    if not hasattr(block, "text"):
        raise ValueError(f"Claude API returned non-text content: {block.type}")
    return block.text
