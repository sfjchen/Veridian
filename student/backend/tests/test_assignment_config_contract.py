import importlib
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _auth_client(user_id: str = "student-1") -> types.SimpleNamespace:
    user = types.SimpleNamespace(
        id=user_id,
        user_metadata={"role": "student"},
        app_metadata={"role": "student"},
    )
    auth = types.SimpleNamespace(get_user=lambda _token: types.SimpleNamespace(user=user))
    return types.SimpleNamespace(auth=auth)


class AssignmentConfigContractTests(unittest.TestCase):
    _MODULE_NAMES = ("get_coords", "anthropic", "websocket_service")

    def setUp(self) -> None:
        self._module_backup = {name: sys.modules.get(name) for name in self._MODULE_NAMES}
        for name in self._MODULE_NAMES:
            sys.modules.pop(name, None)

        os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
        os.environ.setdefault("CLAUDE_MODEL", "claude-test")
        os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
        os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
        os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")
        os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-key")

        anthropic = types.ModuleType("anthropic")

        class Anthropic:
            def __init__(self, api_key: str) -> None:
                _ = api_key

        anthropic.Anthropic = Anthropic
        sys.modules["anthropic"] = anthropic

        websocket_service = types.ModuleType("websocket_service")
        websocket_service.emit_result_ready = lambda *_args, **_kwargs: None
        websocket_service.init_socketio = lambda _app: types.SimpleNamespace()
        sys.modules["websocket_service"] = websocket_service

        self.get_coords = importlib.import_module("get_coords")
        self.client = self.get_coords.app.test_client()

    def tearDown(self) -> None:
        for name in self._MODULE_NAMES:
            sys.modules.pop(name, None)
        for name, module in self._module_backup.items():
            if module is not None:
                sys.modules[name] = module

    def test_get_assignment_requires_auth(self) -> None:
        response = self.client.get("/assignments/assignment-1")
        self.assertEqual(response.status_code, 401)

    def test_get_assignment_forbids_non_member(self) -> None:
        with (
            patch("auth_middleware.get_supabase_auth_client", return_value=_auth_client()),
            patch.object(
                self.get_coords,
                "get_assignment",
                return_value={"id": "assignment-1", "classroom_id": "classroom-1", "title": "A1"},
            ),
            patch.object(self.get_coords, "can_student_access_assignment", return_value=False),
        ):
            response = self.client.get(
                "/assignments/assignment-1",
                headers={"Authorization": "Bearer token"},
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json().get("error"), "Access denied")

    def test_get_assignment_returns_resolved_config_for_member(self) -> None:
        resolved_config = {
            "check_button_visible": True,
            "dot_threshold": "mechanical",
            "max_dots_shown": 3,
            "analysis_trigger": "auto_page_change",
            "analysis_debounce_seconds": 15,
            "notification_style": "toast",
            "chat_enabled": True,
            "hint_level": "guided",
        }

        with (
            patch("auth_middleware.get_supabase_auth_client", return_value=_auth_client()),
            patch.object(
                self.get_coords,
                "get_assignment",
                return_value={
                    "id": "assignment-1",
                    "classroom_id": "classroom-1",
                    "title": "A1",
                    "problems": [],
                },
            ),
            patch.object(self.get_coords, "can_student_access_assignment", return_value=True),
            patch.object(self.get_coords, "get_resolved_config", return_value=resolved_config),
        ):
            response = self.client.get(
                "/assignments/assignment-1",
                headers={"Authorization": "Bearer token"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("assignment", payload)
        self.assertEqual(payload["assignment"]["resolved_config"]["analysis_trigger"], "auto_page_change")


if __name__ == "__main__":
    unittest.main()
