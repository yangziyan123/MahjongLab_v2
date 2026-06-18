from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.classic_games import (
    CLASSIC_GAMES,
    create_classic_training_session,
    serialize_classic_game,
    serialize_classic_training_session,
    submit_classic_training_action,
)
from app.database import Base
from app.models import MatchEvent, User
from app.review_engine import next_actual_action, run_fallback_review


class ClassicTrainingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "classic.db"
        self.engine = create_engine(f"sqlite:///{db_path.as_posix()}")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.user = User(display_name="Tester")
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_session_can_start_from_second_hand_and_records_choice_overlay(self) -> None:
        match = create_classic_training_session(
            self.db,
            user=self.user,
            game_id=CLASSIC_GAMES[0].id,
            start_hand_index=1,
            username="练习者",
        )
        session = serialize_classic_training_session(self.db, match)

        self.assertEqual(session["current_decision"]["hand_label"], "东2局")
        chosen = session["current_decision"]["options"][-1]
        updated = submit_classic_training_action(self.db, match=match, action=chosen)
        updated_session = serialize_classic_training_session(self.db, updated)

        self.assertEqual(updated_session["answered_count"], 1)
        self.assertEqual(updated_session["history"], [])
        self.assertIsNone(updated_session["comparison_summary"])
        event_rows = self.db.scalars(
            select(MatchEvent).where(MatchEvent.match_id == match.id).order_by(MatchEvent.seq),
        ).all()
        overlaid = [
            row.payload_json
            for row in event_rows
            if isinstance(row.payload_json.get("meta"), dict)
        ]
        self.assertEqual(len(overlaid), 1)
        self.assertEqual(overlaid[0]["meta"]["classic_training"]["actual_action"]["pai"], chosen["pai"])

    def test_completed_training_is_reviewable_with_user_action(self) -> None:
        match = create_classic_training_session(
            self.db,
            user=self.user,
            game_id=CLASSIC_GAMES[0].id,
            start_hand_index=1,
            username="练习者",
        )
        first = serialize_classic_training_session(self.db, match)
        different = next(
            option
            for option in first["current_decision"]["options"]
            if option["pai"] != "1m"
        )
        submit_classic_training_action(self.db, match=match, action=different)
        second = serialize_classic_training_session(self.db, match)
        submit_classic_training_action(
            self.db,
            match=match,
            action=second["current_decision"]["options"][0],
        )
        completed = serialize_classic_training_session(self.db, match)

        self.assertEqual(completed["status"], "completed")
        events = [
            row.payload_json
            for row in self.db.scalars(
                select(MatchEvent).where(MatchEvent.match_id == match.id).order_by(MatchEvent.seq),
            ).all()
        ]
        target_tsumo_index = next(
            index
            for index, event in enumerate(events)
            if event.get("type") == "tsumo" and event.get("actor") == 0
        )
        actual = next_actual_action(events, target_tsumo_index, 0)
        self.assertEqual(actual["pai"], different["pai"])

        review = run_fallback_review(events, target_actor=0, reason="test")
        self.assertEqual(review.entries[0].actual_action["pai"], different["pai"])
        self.assertFalse(review.entries[0].is_match)

    def test_only_discard_actions_are_exposed_as_training_decisions(self) -> None:
        game = CLASSIC_GAMES[0]
        serialized = serialize_classic_game(game)

        self.assertEqual(serialized["decision_count"], 4)
        self.assertEqual([hand["decision_count"] for hand in serialized["hands"]], [2, 2])

        match = create_classic_training_session(
            self.db,
            user=self.user,
            game_id=game.id,
            start_hand_index=0,
            username="练习者",
        )

        seen_action_types = []
        while match.status != "completed":
            session = serialize_classic_training_session(self.db, match)
            decision = session["current_decision"]
            self.assertIsNotNone(decision)
            seen_action_types.append(decision["action_type"])
            self.assertEqual(session["history"], [])
            match = submit_classic_training_action(
                self.db,
                match=match,
                action=decision["options"][0],
            )

        completed = serialize_classic_training_session(self.db, match)
        self.assertEqual(seen_action_types, ["dahai"] * 4)
        self.assertEqual(completed["answered_count"], 4)
        self.assertEqual(completed["total_decisions"], 4)
        self.assertEqual(len(completed["history"]), 4)
        self.assertEqual(completed["comparison_summary"]["decision_count"], 4)
        self.assertEqual(len(completed["comparison_summary"]["hands"]), 2)

    def test_comparison_is_revealed_only_after_all_choices(self) -> None:
        match = create_classic_training_session(
            self.db,
            user=self.user,
            game_id=CLASSIC_GAMES[0].id,
            start_hand_index=1,
            username="练习者",
        )
        session = serialize_classic_training_session(self.db, match)
        different = next(
            option
            for option in session["current_decision"]["options"]
            if option["pai"] != "1m"
        )
        match = submit_classic_training_action(self.db, match=match, action=different)

        in_progress = serialize_classic_training_session(self.db, match)
        self.assertEqual(in_progress["answered_count"], 1)
        self.assertEqual(in_progress["history"], [])
        self.assertIsNone(in_progress["comparison_summary"])

        match = submit_classic_training_action(
            self.db,
            match=match,
            action=in_progress["current_decision"]["options"][0],
        )
        completed = serialize_classic_training_session(self.db, match)

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(len(completed["history"]), 2)
        summary = completed["comparison_summary"]
        self.assertEqual(summary["decision_count"], 2)
        self.assertEqual(summary["same_count"] + summary["different_count"], 2)
        self.assertEqual(summary["agreement_rate"], summary["same_count"] / 2)


if __name__ == "__main__":
    unittest.main()
