import importlib
import sys
import types
import unittest
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class _TextBlock:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class _ClaudeResponse:
    def __init__(self, text: str) -> None:
        self.content = [_TextBlock(text)]


def _install_mistake_analysis_import_stubs() -> None:
    anthropic = types.ModuleType("anthropic")
    anthropic.__version__ = "0.79.0"

    class APIError(Exception):
        pass

    class _Messages:
        def create(
            self,
            *,
            model: str,
            max_tokens: int,
            system: str,
            messages: list[dict[str, str]],
            thinking: dict[str, Any] | None = None,
            temperature: float | int | None = None,
        ) -> _ClaudeResponse:
            _ = (model, max_tokens, system, messages, thinking, temperature)
            return _ClaudeResponse("ok")

    class Anthropic:
        def __init__(self) -> None:
            self.messages = _Messages()

    anthropic.APIError = APIError
    anthropic.Anthropic = Anthropic
    sys.modules["anthropic"] = anthropic

    openai = types.ModuleType("openai")

    class OpenAI:
        pass

    openai.OpenAI = OpenAI
    sys.modules["openai"] = openai


class MistakeAnalysisThinkingPayloadTests(unittest.TestCase):
    def setUp(self) -> None:
        for name in ("anthropic", "openai", "mistake_analysis.client"):
            sys.modules.pop(name, None)
        _install_mistake_analysis_import_stubs()
        self.client_module = importlib.import_module("mistake_analysis.client")

    def test_request_text_uses_adaptive_thinking_when_enabled(self) -> None:
        analyzer = self.client_module.MistakeAnalyzer(use_extended_thinking=True)
        captured: dict[str, Any] = {}

        def _fake_call_api(_context: str, **kwargs: Any) -> _ClaudeResponse:
            captured.update(kwargs)
            return _ClaudeResponse("analysis text")

        analyzer._call_api = _fake_call_api
        analyzer._request_text(
            context="analysis",
            system="system",
            user_msg="user",
            max_tokens=2048,
            anthropic_model="claude-opus-4-6",
            use_thinking=True,
        )
        self.assertEqual(captured["thinking"], {"type": "adaptive"})
        self.assertEqual(captured["temperature"], 1)

    def test_request_text_skips_thinking_when_disabled(self) -> None:
        analyzer = self.client_module.MistakeAnalyzer(use_extended_thinking=False)
        captured: dict[str, Any] = {}

        def _fake_call_api(_context: str, **kwargs: Any) -> _ClaudeResponse:
            captured.update(kwargs)
            return _ClaudeResponse("analysis text")

        analyzer._call_api = _fake_call_api
        analyzer._request_text(
            context="analysis",
            system="system",
            user_msg="user",
            max_tokens=2048,
            anthropic_model="claude-opus-4-6",
            use_thinking=False,
        )
        self.assertNotIn("thinking", captured)


if __name__ == "__main__":
    unittest.main()
