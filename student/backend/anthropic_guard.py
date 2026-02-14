import inspect
import re
from typing import Any

MIN_ANTHROPIC_VERSION = (0, 79, 0)
MIN_ANTHROPIC_VERSION_STR = "0.79.0"
REMEDIATION_COMMAND = (
    'cd /Users/davidmaemoto/Desktop/Veridian/student/backend && '
    'pip install -U "anthropic>=0.79.0"'
)


def _parse_version(version: str) -> tuple[int, int, int]:
    match = re.match(r"^\s*(\d+)\.(\d+)\.(\d+)", version or "")
    if match is None:
        raise ValueError(f"Invalid Anthropic version string: {version!r}")
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def _read_installed_anthropic_version() -> str:
    try:
        import anthropic
    except Exception as exc:
        raise RuntimeError(
            "Anthropic SDK is not installed. "
            f"Install it with: {REMEDIATION_COMMAND}"
        ) from exc
    version = getattr(anthropic, "__version__", "")
    if not version:
        raise RuntimeError(
            "Anthropic SDK version could not be detected. "
            f"Install/upgrade with: {REMEDIATION_COMMAND}"
        )
    return str(version)


def ensure_supported_anthropic_version(anthropic_version: str | None = None) -> None:
    version = anthropic_version or _read_installed_anthropic_version()
    try:
        parsed = _parse_version(version)
    except ValueError as exc:
        raise RuntimeError(
            "Anthropic SDK version is unreadable "
            f"({version!r}). Install/upgrade with: {REMEDIATION_COMMAND}"
        ) from exc
    if parsed < MIN_ANTHROPIC_VERSION:
        raise RuntimeError(
            "Unsupported Anthropic SDK version "
            f"{version}. Requires anthropic>={MIN_ANTHROPIC_VERSION_STR}. "
            f"Run: {REMEDIATION_COMMAND}"
        )


def ensure_messages_create_supports_thinking(client: Any) -> None:
    create_method = getattr(getattr(client, "messages", None), "create", None)
    if create_method is None:
        raise RuntimeError(
            "Anthropic client is missing messages.create(). "
            f"Install/upgrade with: {REMEDIATION_COMMAND}"
        )
    try:
        signature = inspect.signature(create_method)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            "Unable to inspect Anthropic messages.create() signature. "
            f"Install/upgrade with: {REMEDIATION_COMMAND}"
        ) from exc
    if "thinking" not in signature.parameters:
        raise RuntimeError(
            "Installed Anthropic SDK does not support the `thinking` parameter "
            "on messages.create(). "
            f"Requires anthropic>={MIN_ANTHROPIC_VERSION_STR}. "
            f"Run: {REMEDIATION_COMMAND}"
        )


def validate_anthropic_thinking_support(
    client: Any,
    anthropic_version: str | None = None,
) -> None:
    ensure_supported_anthropic_version(anthropic_version)
    ensure_messages_create_supports_thinking(client)
