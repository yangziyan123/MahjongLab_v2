from __future__ import annotations

import json
import unittest
from tempfile import TemporaryDirectory
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
import app.main as main_app
from app.majsoul_url_import import MajsoulUrlImportError, parse_majsoul_url
from app.models import Match, MatchEvent, ReviewJob, User
from app.play_launcher import MahjongAiLauncher, MatchRecorder, target_actor_from_agents
from app.review_engine import (
    ReviewExecutionError,
    decode_text_bytes,
    determine_target_actor,
    is_tenhou_sanma_log,
    load_events_from_file,
    load_events_for_job,
    normalize_internal_match_events_for_mjai,
    next_actual_action,
    parse_tenhou_log_payload,
    run_fallback_review,
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


class TextDecodingTests(unittest.TestCase):
    def test_decode_text_bytes_falls_back_to_gb18030(self) -> None:
        self.assertEqual(decode_text_bytes("错误信息".encode("gb18030")), "错误信息")

    def test_load_events_from_file_accepts_gbk_jsonl(self) -> None:
        with TemporaryDirectory() as temp_dir:
            replay_path = Path(temp_dir) / "replay.jsonl"
            payload = {"type": "start_game", "note": "中文备注"}
            replay_path.write_bytes((json.dumps(payload, ensure_ascii=False) + "\n").encode("gb18030"))

            self.assertEqual(load_events_from_file(replay_path), [payload])


class FallbackReviewTests(unittest.TestCase):
    def test_fallback_review_keeps_internal_match_reviewable_without_engine(self) -> None:
        result = run_fallback_review(
            [
                {"type": "start_game"},
                {
                    "type": "start_kyoku",
                    "bakaze": "E",
                    "kyoku": 1,
                    "honba": 0,
                    "kyotaku": 0,
                    "oya": 0,
                    "scores": [25000, 25000, 25000, 25000],
                    "dora_marker": "2s",
                    "tehais": [
                        ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "4p"],
                        ["?"] * 13,
                        ["?"] * 13,
                        ["?"] * 13,
                    ],
                },
                {"type": "tsumo", "actor": 0, "pai": "1m"},
                {"type": "dahai", "actor": 0, "pai": "1m", "tsumogiri": True},
                {"type": "end_kyoku"},
            ],
            target_actor=0,
            reason="test",
        )

        self.assertEqual(result.engine_name, "mjai-reviewer-lite")
        self.assertEqual(result.summary["reviewed_decision_count"], 1)
        self.assertEqual(result.entries[0].decision_type, "discard")
        self.assertTrue(result.entries[0].is_match)
        table = result.entries[0].state_snapshot["table"]
        self.assertEqual(table["target_actor"], 0)
        self.assertEqual(table["dora_markers"], ["2s"])
        self.assertEqual(table["discards"][0][0]["pai"], "1m")
        self.assertEqual(
            table["hands"][0],
            ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "4p"],
        )


class PlayRecorderTests(unittest.TestCase):
    def test_target_actor_from_agents_finds_human_player_seat(self) -> None:
        agents = [
            {"username": "一姬1(简单)", "is_ai": True},
            {"username": "一姬2(简单)", "is_ai": True},
            {"username": "一姬3(简单)", "is_ai": True},
            {"username": "User1", "is_ai": False},
        ]

        self.assertEqual(target_actor_from_agents(agents, "User1"), 3)

    def test_target_actor_from_agents_returns_none_for_unknown_player(self) -> None:
        self.assertIsNone(target_actor_from_agents([{"username": "一姬1(简单)"}], "User1"))


    def test_start_kyoku_conversion_emits_mjai_compatible_shape(self) -> None:
        class TestLauncher(MahjongAiLauncher):
            def _update_match(self, match_id: str, status: str, result: dict | None = None) -> None:
                return None

            def _update_match_source(self, match_id: str, updates: dict) -> None:
                return None

        launcher = TestLauncher(SimpleNamespace())
        recorder = MatchRecorder(
            match_id="match-1",
            username="User1",
            host="127.0.0.1",
            port=0,
            stop_event=SimpleNamespace(),
        )
        launcher._recorder = recorder

        events = launcher._convert_protocol_event(
            recorder,
            {
                "event": "start",
                "game": {
                    "round": 0,
                    "honba": 0,
                    "riichi_ba": 0,
                    "oya": 0,
                    "dora_indicator": [104],
                    "agents": [
                        {"username": "AI1", "score": 250, "tile_count": 14, "is_ai": True},
                        {"username": "AI2", "score": 250, "tile_count": 13, "is_ai": True},
                        {"username": "AI3", "score": 250, "tile_count": 13, "is_ai": True},
                        {"username": "User1", "score": 250, "tile_count": 14, "is_ai": False},
                    ],
                },
                "self": {
                    "seat": 3,
                    "tiles": [31, 94, 33, 1, 4, 37, 108, 116, 78, 53, 21, 61, 73, 74],
                },
            },
        )

        start_kyoku = events[1]
        self.assertEqual(start_kyoku["dora_marker"], "9s")
        self.assertEqual(start_kyoku["scores"], [25000, 25000, 25000, 25000])
        self.assertEqual([len(hand) for hand in start_kyoku["tehais"]], [13, 13, 13, 13])

    def test_internal_match_normalization_adds_missing_terminal_deltas(self) -> None:
        events = normalize_internal_match_events_for_mjai(
            [
                {"type": "start_kyoku", "dora_marker": "1m", "tehais": [["?"] * 13] * 4},
                {"type": "hora", "actor": 0, "target": 1, "pai": "1m"},
                {"type": "ryukyoku"},
            ],
        )

        self.assertEqual(events[1]["deltas"], [0, 0, 0, 0])
        self.assertEqual(events[2]["deltas"], [0, 0, 0, 0])

    def test_reaction_window_does_not_match_future_discard(self) -> None:
        events = [
            {"type": "start_kyoku"},
            {"type": "dahai", "actor": 1, "pai": "9m", "tsumogiri": False},
            {"type": "tsumo", "actor": 2, "pai": "8s"},
            {"type": "dahai", "actor": 2, "pai": "F", "tsumogiri": False},
        ]

        self.assertIsNone(next_actual_action(events, 1, 2))
        self.assertEqual(next_actual_action(events, 2, 2), events[3])


class PlayReviewEndpointTests(unittest.TestCase):
    def test_create_play_match_review_uses_recorded_target_actor_and_event_snapshot(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            old_enqueue = main_app.enqueue_review_job
            main_app.enqueue_review_job = lambda job_id: None
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(
                    user_id=user.id,
                    status="round_finished",
                    source_json={"username": "User1", "target_actor": 3, "target_player_label": "User1"},
                )
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add_all(
                    [
                        MatchEvent(match_id=match.id, seq=0, event_type="start_game", payload_json={"type": "start_game"}),
                        MatchEvent(
                            match_id=match.id,
                            seq=1,
                            event_type="start_kyoku",
                            payload_json={"type": "start_kyoku", "honba": 0},
                        ),
                        MatchEvent(match_id=match.id, seq=2, event_type="end_kyoku", payload_json={"type": "end_kyoku"}),
                    ],
                )
                db.commit()

                job = main_app.create_play_match_review(match.id, db)

                self.assertEqual(job.source_type, "internal_match")
                self.assertEqual(job.target_player_ref, "3")
                created_job = db.get(ReviewJob, job.id)
                self.assertIsNotNone(created_job)
                self.assertEqual(created_job.match_id, match.id)
                self.assertEqual(created_job.source_payload["event_limit"], 3)

                same_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertEqual(same_snapshot_job.id, job.id)

                match.status = "running"
                db.add(MatchEvent(match_id=match.id, seq=3, event_type="tsumo", payload_json={"type": "tsumo"}))
                db.commit()
                still_same_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertEqual(still_same_snapshot_job.id, job.id)

                db.add(MatchEvent(match_id=match.id, seq=4, event_type="end_kyoku", payload_json={"type": "end_kyoku"}))
                db.commit()
                next_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertNotEqual(next_snapshot_job.id, job.id)
                next_created_job = db.get(ReviewJob, next_snapshot_job.id)
                self.assertEqual(next_created_job.source_payload["event_limit"], 5)
            finally:
                main_app.enqueue_review_job = old_enqueue
                db.close()
                engine.dispose()

    def test_internal_match_event_limit_loads_snapshot_only(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(user_id=user.id, status="round_finished", source_json={})
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add_all(
                    [
                        MatchEvent(match_id=match.id, seq=0, event_type="start_game", payload_json={"type": "start_game"}),
                        MatchEvent(
                            match_id=match.id,
                            seq=1,
                            event_type="start_kyoku",
                            payload_json={"type": "start_kyoku"},
                        ),
                        MatchEvent(match_id=match.id, seq=2, event_type="end_kyoku", payload_json={"type": "end_kyoku"}),
                    ],
                )
                db.commit()

                job = SimpleNamespace(
                    source_type="internal_match",
                    source_payload={"match_id": match.id, "event_limit": 2},
                    match_id=match.id,
                )

                events = load_events_for_job(db, job)

                self.assertEqual([event["type"] for event in events], ["start_game", "start_kyoku"])
            finally:
                db.close()
                engine.dispose()

    def test_internal_match_loader_normalizes_recorded_start_kyoku(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(user_id=user.id, status="round_finished", source_json={})
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add(
                    MatchEvent(
                        match_id=match.id,
                        seq=0,
                        event_type="start_kyoku",
                        payload_json={
                            "type": "start_kyoku",
                            "bakaze": "E",
                            "kyoku": 1,
                            "honba": 0,
                            "kyotaku": 0,
                            "oya": 0,
                            "dora_marker": ["9s"],
                            "scores": [25000, 25000, 25000, 25000],
                            "tehais": [["?"] * 14, ["?"] * 13, ["?"] * 13, ["1m"] * 14],
                        },
                    ),
                )
                db.commit()
                job = SimpleNamespace(
                    source_type="internal_match",
                    source_payload={"match_id": match.id},
                    match_id=match.id,
                )

                events = load_events_for_job(db, job)

                self.assertEqual(events[0]["dora_marker"], "9s")
                self.assertEqual([len(hand) for hand in events[0]["tehais"]], [13, 13, 13, 13])
                self.assertEqual(events[1], {"type": "tsumo", "actor": 0, "pai": "?"})
                self.assertEqual(events[2], {"type": "tsumo", "actor": 3, "pai": "1m"})
            finally:
                db.close()
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
