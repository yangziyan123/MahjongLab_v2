from __future__ import annotations

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
from app.play_launcher import target_actor_from_agents
from app.review_engine import (
    ReviewExecutionError,
    determine_target_actor,
    is_tenhou_sanma_log,
    load_events_for_job,
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


class FallbackReviewTests(unittest.TestCase):
    def test_fallback_review_keeps_internal_match_reviewable_without_engine(self) -> None:
        result = run_fallback_review(
            [
                {"type": "start_game"},
                {"type": "start_kyoku", "honba": 0},
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


if __name__ == "__main__":
    unittest.main()
