import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config_schema import validate_config


class ConfigSchemaTests(unittest.TestCase):
    def test_validate_config_accepts_auto_page_change(self) -> None:
        cfg = validate_config({"analysis_trigger": "auto_page_change"})
        self.assertEqual(cfg["analysis_trigger"], "auto_page_change")

    def test_validate_config_rejects_unknown_analysis_trigger(self) -> None:
        with self.assertRaisesRegex(ValueError, "analysis_trigger"):
            validate_config({"analysis_trigger": "invalid-mode"})


if __name__ == "__main__":
    unittest.main()
