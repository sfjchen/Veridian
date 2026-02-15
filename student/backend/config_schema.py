# Canonical copy: teacher/backend/app/services/config_schema.py
# Keep in sync manually — no shared package exists.
# To verify sync: run scripts/check_config_schema_sync.sh
"""Assignment/classroom config validation and resolution.

Single source of truth for config field definitions, validation rules,
and the resolution algorithm (hardcoded defaults < classroom < assignment).

All config writes MUST go through validate_config() before persisting to
the database. The DB stores raw JSONB with no schema constraint.
"""

from typing import Any

HARDCODED_DEFAULTS: dict[str, Any] = {
    "check_button_visible": True,
    "dot_threshold": "mechanical",
    "max_dots_shown": 0,
    "analysis_trigger": "auto_idle",
    "analysis_debounce_seconds": 15,
    "notification_style": "toast",
    "chat_enabled": True,
    "hint_level": "guided",
    "student_mistake_visibility": False,
}

VALID_VALUES: dict[str, list[str]] = {
    "dot_threshold": ["notational", "mechanical", "procedural", "conceptual"],
    "analysis_trigger": ["auto_idle", "auto_page_change", "manual_only", "passive"],
    "notification_style": ["silent", "toast", "badge"],
    "hint_level": ["guided", "minimal", "detailed"],
}

_BOOL_FIELDS = {"check_button_visible", "chat_enabled", "student_mistake_visibility"}
_INT_FIELDS = {"max_dots_shown", "analysis_debounce_seconds"}
_ENUM_FIELDS = set(VALID_VALUES.keys())

_INT_RANGES: dict[str, tuple[int, int]] = {
    "max_dots_shown": (0, 50),
    "analysis_debounce_seconds": (1, 300),
}


def _validate_bool_field(key: str, value: Any) -> None:
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a boolean")


def _validate_int_field(key: str, value: Any) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    lo, hi = _INT_RANGES[key]
    if value < lo or value > hi:
        raise ValueError(f"{key} must be between {lo} and {hi}")


def _validate_enum_field(key: str, value: Any) -> None:
    if not isinstance(value, str) or value not in VALID_VALUES[key]:
        raise ValueError(f"{key} must be one of {VALID_VALUES[key]}")


def validate_config(config: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and return a cleaned sparse config dict.

    Raises ValueError on unknown fields or invalid values.
    """
    if config is None:
        return {}
    if not isinstance(config, dict):
        raise ValueError("config must be a dict")
    cleaned: dict[str, Any] = {}
    for key, value in config.items():
        if key not in HARDCODED_DEFAULTS:
            raise ValueError(f"Unknown config field: {key}")
        if key in _BOOL_FIELDS:
            _validate_bool_field(key, value)
        elif key in _INT_FIELDS:
            _validate_int_field(key, value)
        elif key in _ENUM_FIELDS:
            _validate_enum_field(key, value)
        cleaned[key] = value
    return cleaned


def resolve_config(classroom_config: dict[str, Any], assignment_config: dict[str, Any]) -> dict[str, Any]:
    """Merge config layers: hardcoded defaults < classroom < assignment.

    Both inputs are validated before merging.
    """
    resolved = dict(HARDCODED_DEFAULTS)
    resolved.update(validate_config(classroom_config))
    resolved.update(validate_config(assignment_config))
    return resolved
