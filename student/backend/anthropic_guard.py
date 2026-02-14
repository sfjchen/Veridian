import inspect
import re
from typing import Any, Literal, Protocol, TypedDict

# Minimum version that supports `thinking` on messages.create().
MIN_ANTHROPIC_VERSION = (0, 79, 0)
MIN_ANTHROPIC_VERSION_STR = ".".join(str(part) for part in MIN_ANTHROPIC_VERSION)
MIN_THINKING_BUDGET_TOKENS = 1024
REMEDIATION_COMMAND = 'pip install -U "anthropic>=0.79.0"'
_VERSION_PATTERN = re.compile(
    r"^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<micro>\d+)"
    r"(?:\.post\d+)?"
    r"(?:\+[A-Za-z0-9][A-Za-z0-9._-]*)?$"
)


class _MessagesClientProtocol(Protocol):
    messages: Any


class ThinkingEnabledConfig(TypedDict):
    type: Literal["enabled"]
    budget_tokens: int


class ThinkingAdaptiveConfig(TypedDict):
    type: Literal["adaptive"]


def _parse_version(version: str) -> tuple[int, int, int]:
    trimmed = version.strip()
    if not trimmed:
        raise ValueError("Anthropic SDK version string is empty.")
    match = _VERSION_PATTERN.match(trimmed)
    if match is None:
        raise ValueError(f"Invalid Anthropic SDK version string: {version!r}")
    return (
        int(match.group("major")),
        int(match.group("minor")),
        int(match.group("micro")),
    )


def _read_installed_anthropic_version() -> str:
    try:
        import anthropic
    except Exception as exc:
        raise RuntimeError(
            "Anthropic SDK is not installed. "
            f"Run: {REMEDIATION_COMMAND}"
        ) from exc
    version = getattr(anthropic, "__version__", None)
    if version is None:
        raise RuntimeError(
            "Anthropic SDK version could not be detected. "
            f"Run: {REMEDIATION_COMMAND}"
        )
    version_str = str(version).strip()
    if not version_str:
        raise RuntimeError(
            "Anthropic SDK version could not be detected. "
            f"Run: {REMEDIATION_COMMAND}"
        )
    return version_str


def ensure_supported_anthropic_version(anthropic_version: str | None = None) -> None:
    version = anthropic_version or _read_installed_anthropic_version()
    try:
        parsed = _parse_version(version)
    except ValueError as exc:
        raise RuntimeError(
            "Anthropic SDK version is unreadable "
            f"({version!r}). Run: {REMEDIATION_COMMAND}"
        ) from exc
    if parsed < MIN_ANTHROPIC_VERSION:
        raise RuntimeError(
            "Unsupported Anthropic SDK version "
            f"{version}. Requires anthropic>={MIN_ANTHROPIC_VERSION_STR}. "
            f"Run: {REMEDIATION_COMMAND}"
        )


def ensure_messages_create_supports_thinking(client: _MessagesClientProtocol) -> None:
    create_method = getattr(getattr(client, "messages", None), "create", None)
    if create_method is None:
        raise RuntimeError(
            "Anthropic client is missing messages.create(). "
            f"Run: {REMEDIATION_COMMAND}"
        )
    try:
        signature = inspect.signature(create_method)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            "Unable to inspect Anthropic messages.create() signature. "
            f"Run: {REMEDIATION_COMMAND}"
        ) from exc
    if "thinking" not in signature.parameters:
        raise RuntimeError(
            "Installed Anthropic SDK does not support the `thinking` parameter "
            "on messages.create(). "
            f"Requires anthropic>={MIN_ANTHROPIC_VERSION_STR}. "
            f"Run: {REMEDIATION_COMMAND}"
        )


def validate_anthropic_thinking_support(
    client: _MessagesClientProtocol,
    anthropic_version: str | None = None,
) -> None:
    ensure_supported_anthropic_version(anthropic_version)
    ensure_messages_create_supports_thinking(client)


def build_enabled_thinking(
    max_tokens: int,
    budget_tokens: int,
) -> ThinkingEnabledConfig:
    if not isinstance(max_tokens, int) or max_tokens <= 0:
        raise TypeError(f"max_tokens must be a positive integer, got {max_tokens!r}")
    if not isinstance(budget_tokens, int) or budget_tokens <= 0:
        raise TypeError(f"budget_tokens must be a positive integer, got {budget_tokens!r}")
    if max_tokens <= MIN_THINKING_BUDGET_TOKENS:
        raise ValueError(
            "max_tokens must be greater than "
            f"{MIN_THINKING_BUDGET_TOKENS} to allow "
            f"minimum budget_tokens={MIN_THINKING_BUDGET_TOKENS}; got {max_tokens}"
        )
    if budget_tokens < MIN_THINKING_BUDGET_TOKENS:
        raise ValueError(
            f"budget_tokens must be >= {MIN_THINKING_BUDGET_TOKENS}, got {budget_tokens}"
        )
    if budget_tokens >= max_tokens:
        raise ValueError(
            "budget_tokens must be less than max_tokens; "
            f"got budget_tokens={budget_tokens}, max_tokens={max_tokens}"
        )
    return {"type": "enabled", "budget_tokens": budget_tokens}


def build_adaptive_thinking() -> ThinkingAdaptiveConfig:
    return {"type": "adaptive"}
