from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace

from app.majsoul_url_import import MajsoulUrlImportError, parse_majsoul_url
from app.review_engine import (
    ReviewExecutionError,
    determine_target_actor,
    is_tenhou_sanma_log,
    parse_tenhou_log_payload,
    validate_tenhou_log_payload,
)


class TenhouLogValidationTests(unittest.TestCase):
    def test_detects_sanma_log_before_conversion(self) -> None:
        sanma_payload = {
            "ref": "2024112700gm-0119-0001-4f9c7e06",
            "log": [
                [
                    [0, 0, 0],
                    [40000, 40000, 40000, 0],
                    [52],
                    [],
                    [19, 21, 21, 31, 32, 33, 53, 36, 37, 43, 43, 44, 46],
                    [25],
                    [19],
                    [11, 24, 28, 31, 34, 35, 38, 39, 39, 42, 42, 42, 47],
                    [11],
                    [28],
                    [19, 19, 21, 22, 23, 24, 25, 26, 27, 29, 37, 46, 47],
                    [35],
                    [47],
                    [],
                    [],
                    [],
                    ["和了", [-2600, 5200, -2600, 0], [1, 1, 1]],
                ]
            ],
            "name": ["A", "B", "C", ""],
            "rule": {"disp": "三麻"},
        }

        self.assertTrue(is_tenhou_sanma_log(sanma_payload))
        with self.assertRaisesRegex(ReviewExecutionError, "sanma log .* is not supported yet"):
            validate_tenhou_log_payload(sanma_payload, "2024112700gm-0119-0001-4f9c7e06")

    def test_allows_regular_four_player_tenhou_log(self) -> None:
        sample_path = Path(__file__).resolve().parents[1] / "data" / "smoke" / "tenhou_raw.json"
        payload = parse_tenhou_log_payload(sample_path.read_text(encoding="utf-8"), "2019050417gm-0029-0000-4f2a8622")

        self.assertFalse(is_tenhou_sanma_log(payload))
        validate_tenhou_log_payload(payload, "2019050417gm-0029-0000-4f2a8622")


class MajsoulUrlImportTests(unittest.TestCase):
    def test_parse_majsoul_url_extracts_origin_and_uuid(self) -> None:
        base_url, game_uuid = parse_majsoul_url("https://game.maj-soul.com/1/?paipu=240101-uuid-demo")

        self.assertEqual(base_url, "https://game.maj-soul.com/")
        self.assertEqual(game_uuid, "240101-uuid-demo")

    def test_parse_majsoul_url_rejects_missing_paipu(self) -> None:
        with self.assertRaisesRegex(MajsoulUrlImportError, "valid paipu parameter"):
            parse_majsoul_url("https://game.maj-soul.com/1/")


class TargetActorValidationTests(unittest.TestCase):
    def test_majsoul_import_requires_explicit_target_player(self) -> None:
        job = SimpleNamespace(source_type="majsoul_url", target_actor=None, target_player_ref=None)

        with self.assertRaisesRegex(ReviewExecutionError, "target_player_ref"):
            determine_target_actor(job)

    def test_majsoul_import_accepts_explicit_target_player(self) -> None:
        job = SimpleNamespace(source_type="majsoul_file", target_actor=None, target_player_ref="2")

        self.assertEqual(determine_target_actor(job), 2)


if __name__ == "__main__":
    unittest.main()
