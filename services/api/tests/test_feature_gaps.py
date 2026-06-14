from __future__ import annotations

import json
import unittest
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main as main_app
from app.database import Base
from app.models import Match, Review, ReviewEntry, ReviewJob, User


class FeatureGapEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test.db"
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

    def create_review(self, *, created_days_ago: int = 0, platform: str = "tenhou") -> tuple[Review, ReviewEntry]:
        job = ReviewJob(
            user_id=self.user.id,
            status="completed",
            source_type="upload",
            source_payload={},
            options_json={"anonymous": True},
            attempt_count=1,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        review = Review(
            job_id=job.id,
            user_id=self.user.id,
            platform=platform,
            target_actor=0,
            target_player_label="测试玩家",
            model_tag="test-model",
            result_object_key=f"reviews/{job.id}.json",
            created_at=main_app.utcnow() - timedelta(days=created_days_ago),
        )
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        job.review_id = review.id

        entry = ReviewEntry(
            review_id=review.id,
            seq=1,
            kyoku_index=0,
            junme=4,
            decision_type="discard",
            actual_action_json={"type": "dahai", "pai": "9m"},
            expected_action_json={"type": "dahai", "pai": "1p"},
            is_match=False,
            deviation_level="high",
            state_snapshot_json={"tehai": ["1m"]},
            tags_json=["efficiency"],
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return review, entry

    def test_review_history_filters_before_paginating(self) -> None:
        old_review, _ = self.create_review(created_days_ago=40, platform="majsoul")
        recent_review, _ = self.create_review(created_days_ago=2, platform="tenhou")

        page = main_app.list_reviews(
            q=None,
            platform=None,
            date_range="week",
            page=1,
            page_size=1,
            db=self.db,
        )

        self.assertEqual(page.total, 1)
        self.assertEqual(page.items[0].id, recent_review.id)
        self.assertNotEqual(page.items[0].id, old_review.id)

    def test_play_history_filters_type_and_time_before_paginating(self) -> None:
        old_match = Match(
            user_id=self.user.id,
            status="completed",
            match_type="hanchan",
            source_json={"username": "Old"},
            updated_at=main_app.utcnow() - timedelta(days=40),
        )
        recent_match = Match(
            user_id=self.user.id,
            status="completed",
            match_type="tonpu",
            source_json={"username": "Recent"},
        )
        self.db.add_all([old_match, recent_match])
        self.db.commit()

        page = main_app.list_play_matches(
            q=None,
            status_filter=None,
            match_type="tonpu",
            date_range="month",
            page=1,
            page_size=1,
            db=self.db,
        )

        self.assertEqual(page.total, 1)
        self.assertEqual(page.items[0].id, recent_match.id)

    def test_anonymous_export(self) -> None:
        review, _ = self.create_review()
        response = main_app.export_review(review.id, anonymous=None, db=self.db)
        payload = json.loads(response.body)
        self.assertTrue(payload["anonymous"])
        self.assertEqual(payload["review"]["target_player_label"], "匿名玩家")
        self.assertEqual(len(payload["entries"]), 1)


if __name__ == "__main__":
    unittest.main()
