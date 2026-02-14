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


def _install_chat_import_stubs() -> None:
    anthropic = types.ModuleType("anthropic")

    class Anthropic:  # noqa: D401
        def __init__(self, api_key: str) -> None:
            _ = api_key

    anthropic.Anthropic = Anthropic
    anthropic.__version__ = "0.79.0"
    sys.modules["anthropic"] = anthropic

    assignment_service = types.ModuleType("assignment_service")

    def get_problem(assignment_id: str, problem_num: int) -> dict[str, Any]:
        return {"assignment_id": assignment_id, "problem_num": problem_num}

    assignment_service.get_problem = get_problem
    sys.modules["assignment_service"] = assignment_service

    chat_service = types.ModuleType("chat_service")
    chat_service.ChatMessageInsert = dict
    chat_service.SAMPLE_ALGEBRA_ASSIGNMENT_ID = "sample-assignment"
    chat_service.SAMPLE_ALGEBRA_PROBLEMS = [{"num": 1}]
    chat_service.build_chat_context = lambda *_args, **_kwargs: {}
    chat_service.get_chat_history = lambda *_args, **_kwargs: []
    chat_service.save_message = lambda *_args, **_kwargs: None
    sys.modules["chat_service"] = chat_service


class ChatThinkingPayloadTests(unittest.TestCase):
    def setUp(self) -> None:
        for name in ("chat", "anthropic", "assignment_service", "chat_service"):
            sys.modules.pop(name, None)
        _install_chat_import_stubs()
        self.chat = importlib.import_module("chat")

    def test_call_claude_uses_enabled_thinking_payload(self) -> None:
        captured: dict[str, Any] = {}

        class _FakeMessages:
            def create(self, **kwargs: Any) -> _ClaudeResponse:
                captured.update(kwargs)
                return _ClaudeResponse("Tutor reply")

        class _FakeClient:
            def __init__(self) -> None:
                self.messages = _FakeMessages()

        self.chat._get_anthropic_client = lambda: _FakeClient()
        result = self.chat._call_claude([{"role": "user", "content": "Help me"}])

        self.assertEqual(result, "Tutor reply")
        self.assertEqual(self.chat.CHAT_MAX_TOKENS, 16000)
        self.assertEqual(self.chat.BUDGET_TOKENS, 8000)
        self.assertEqual(captured["thinking"]["type"], "enabled")
        self.assertEqual(captured["thinking"]["budget_tokens"], 8000)
        self.assertEqual(captured["max_tokens"], 16000)


if __name__ == "__main__":
    unittest.main()
