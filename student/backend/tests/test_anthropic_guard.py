import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anthropic_guard import (  # noqa: E402
    build_enabled_thinking,
    ensure_messages_create_supports_thinking,
    ensure_supported_anthropic_version,
)


class _ClientWithThinking:
    class _Messages:
        def create(self, *, model: str, max_tokens: int, thinking: dict | None = None) -> None:
            _ = (model, max_tokens, thinking)
            return None

    def __init__(self) -> None:
        self.messages = self._Messages()


class _ClientWithoutThinking:
    class _Messages:
        def create(self, *, model: str, max_tokens: int) -> None:
            _ = (model, max_tokens)
            return None

    def __init__(self) -> None:
        self.messages = self._Messages()


class AnthropicGuardTests(unittest.TestCase):
    def test_rejects_unsupported_version(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Unsupported Anthropic SDK version"):
            ensure_supported_anthropic_version("0.78.9")

    def test_accepts_supported_version(self) -> None:
        ensure_supported_anthropic_version("0.79.0")

    def test_rejects_prerelease_version_format(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "version is unreadable"):
            ensure_supported_anthropic_version("0.79.0-beta1")

    def test_rejects_missing_thinking_signature(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "does not support the `thinking` parameter"):
            ensure_messages_create_supports_thinking(_ClientWithoutThinking())

    def test_accepts_thinking_signature(self) -> None:
        ensure_messages_create_supports_thinking(_ClientWithThinking())

    def test_enabled_thinking_max_tokens_guard(self) -> None:
        with self.assertRaisesRegex(ValueError, "greater than 1024"):
            build_enabled_thinking(max_tokens=1024, budget_tokens=1024)

    def test_enabled_thinking_budget_guard(self) -> None:
        with self.assertRaisesRegex(ValueError, "must be >= 1024"):
            build_enabled_thinking(max_tokens=2000, budget_tokens=1023)

    def test_enabled_thinking_requires_budget_less_than_max(self) -> None:
        with self.assertRaisesRegex(ValueError, "must be less than max_tokens"):
            build_enabled_thinking(max_tokens=2000, budget_tokens=2000)


if __name__ == "__main__":
    unittest.main()
