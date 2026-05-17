from __future__ import annotations

import json
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone

from .config import settings
from .database import SessionLocal
from .models import Match, Review, ReviewEntry, ReviewJob
from .review_engine import ReviewExecutionError, execute_review_job

executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="review-job")
active_jobs: dict[str, Future[None]] = {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enqueue_review_job(job_id: str) -> Future[None]:
    future = executor.submit(process_review_job, job_id)
    active_jobs[job_id] = future
    return future


def write_review_payload(review_id: str, payload: dict) -> str:
    settings.review_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.review_dir / f"{review_id}.json"
    file_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(file_path.relative_to(settings.storage_dir)).replace("\\", "/")


def process_review_job(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = db.get(ReviewJob, job_id)
        if job is None:
            return

        job.status = "parsing"
        job.progress = 10
        job.step = "parsing"
        job.started_at = utcnow()
        db.commit()

        job.status = "analyzing"
        job.progress = 50
        job.step = "analyzing"
        db.commit()

        result = execute_review_job(db, job)
        target_player_label = job.target_player_ref
        if job.match_id:
            match = db.get(Match, job.match_id)
            if match is not None and isinstance(match.source_json, dict):
                username = match.source_json.get("username")
                if isinstance(username, str) and username.strip():
                    target_player_label = username.strip()
        review = Review(
            job_id=job.id,
            user_id=job.user_id,
            match_id=job.match_id,
            platform=job.platform,
            target_actor=result.target_actor,
            target_player_label=target_player_label,
            engine_name=result.engine_name,
            engine_version=result.engine_version,
            model_tag=result.model_tag,
            reviewed_decision_count=result.summary["reviewed_decision_count"],
            match_decision_count=result.summary["match_decision_count"],
            high_deviation_count=result.summary["high_deviation_count"],
            medium_deviation_count=result.summary["medium_deviation_count"],
            optimal_count=result.summary["optimal_count"],
            rating=result.rating,
            temperature=result.temperature,
            summary_json=result.summary,
            stats_json=result.stats,
            result_object_key="pending",
        )
        db.add(review)
        db.flush()

        review.result_object_key = write_review_payload(review.id, result.raw_result)

        for entry in result.entries:
            db.add(
                ReviewEntry(
                    review_id=review.id,
                    seq=entry.seq,
                    kyoku_index=entry.kyoku_index,
                    honba=entry.honba,
                    junme=entry.junme,
                    tiles_left=entry.tiles_left,
                    last_actor=entry.last_actor,
                    tile=entry.tile,
                    decision_type=entry.decision_type,
                    actual_action_json=entry.actual_action,
                    expected_action_json=entry.expected_action,
                    is_match=entry.is_match,
                    deviation_level=entry.deviation_level,
                    delta_score=entry.delta_score,
                    shanten=entry.shanten,
                    at_furiten=entry.at_furiten,
                    details_json=entry.details,
                    state_snapshot_json=entry.state_snapshot,
                    tags_json=entry.tags,
                ),
            )

        job.review_id = review.id
        job.status = "completed"
        job.progress = 100
        job.step = "completed"
        job.error_code = None
        job.error_message = None
        job.completed_at = utcnow()
        db.commit()
    except ReviewExecutionError as exc:
        db.rollback()
        job = db.get(ReviewJob, job_id)
        if job is not None:
            job.status = "failed"
            job.progress = 100
            job.step = "failed"
            job.error_code = "review_execution_error"
            job.error_message = str(exc)
            job.completed_at = utcnow()
            db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(ReviewJob, job_id)
        if job is not None:
            job.status = "failed"
            job.progress = 100
            job.step = "failed"
            job.error_code = "unexpected_error"
            job.error_message = str(exc)
            job.completed_at = utcnow()
            db.commit()
        raise
    finally:
        active_jobs.pop(job_id, None)
        db.close()
