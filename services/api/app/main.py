from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .jobs import enqueue_review_job
from .models import Review, ReviewEntry, ReviewJob, User
from .schemas import (
    CreateReviewJobRequest,
    DashboardSummary,
    PaginatedReviewEntries,
    PaginatedReviews,
    ReplaySourceOption,
    ReviewEntryOut,
    ReviewJobOut,
    ReviewJobResultOut,
    ReviewOut,
    UploadResponse,
    UserProfile,
)

app = FastAPI(title="MahjongLab API", version="0.1.0")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_default_user(db: Session) -> User:
    user = db.scalar(select(User).limit(1))
    if user is not None:
        return user

    user = User(display_name="MahjongLab User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def serialize_review_job(job: ReviewJob) -> ReviewJobOut:
    return ReviewJobOut(
        id=job.id,
        status=job.status,
        progress=job.progress,
        step=job.step,
        source_type=job.source_type,
        platform=job.platform,
        source=job.source_payload or {},
        options=job.options_json or {},
        target_player_ref=job.target_player_ref,
        target_actor=job.target_actor,
        review_id=job.review_id,
        error_code=job.error_code,
        error_message=job.error_message,
        attempt_count=job.attempt_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
        queued_at=job.queued_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


def serialize_review(review: Review) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        job_id=review.job_id,
        platform=review.platform,
        target_actor=review.target_actor,
        target_player_label=review.target_player_label,
        engine_name=review.engine_name,
        engine_version=review.engine_version,
        model_tag=review.model_tag,
        reviewed_decision_count=review.reviewed_decision_count,
        match_decision_count=review.match_decision_count,
        high_deviation_count=review.high_deviation_count,
        medium_deviation_count=review.medium_deviation_count,
        optimal_count=review.optimal_count,
        rating=float(review.rating) if review.rating is not None else None,
        temperature=float(review.temperature) if review.temperature is not None else None,
        summary=review.summary_json or {},
        stats=review.stats_json or {},
        result_object_key=review.result_object_key,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


def serialize_entry(entry: ReviewEntry) -> ReviewEntryOut:
    return ReviewEntryOut(
        id=entry.id,
        review_id=entry.review_id,
        seq=entry.seq,
        kyoku_index=entry.kyoku_index,
        honba=entry.honba,
        junme=entry.junme,
        tiles_left=entry.tiles_left,
        last_actor=entry.last_actor,
        tile=entry.tile,
        decision_type=entry.decision_type,
        actual_action=entry.actual_action_json,
        expected_action=entry.expected_action_json or {},
        is_match=entry.is_match,
        deviation_level=entry.deviation_level,
        delta_score=float(entry.delta_score) if entry.delta_score is not None else None,
        shanten=entry.shanten,
        at_furiten=entry.at_furiten,
        details=entry.details_json or [],
        state_snapshot=entry.state_snapshot_json or {},
        tags=entry.tags_json or [],
        created_at=entry.created_at,
    )


@app.on_event("startup")
def on_startup() -> None:
    settings.ensure_dirs()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        get_or_create_default_user(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me", response_model=UserProfile, response_model_by_alias=False)
def get_me(db: Session = Depends(get_db)) -> UserProfile:
    user = get_or_create_default_user(db)
    return UserProfile(id=user.id, display_name=user.display_name, locale=user.locale, timezone=user.timezone)


@app.get("/api/dashboard/summary", response_model=DashboardSummary, response_model_by_alias=False)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    review_count = db.scalar(select(func.count(Review.id))) or 0
    completed_job_count = db.scalar(select(func.count(ReviewJob.id)).where(ReviewJob.status == "completed")) or 0
    failed_job_count = db.scalar(select(func.count(ReviewJob.id)).where(ReviewJob.status == "failed")) or 0
    return DashboardSummary(
        review_count=int(review_count),
        completed_job_count=int(completed_job_count),
        failed_job_count=int(failed_job_count),
    )


@app.get("/api/platforms/replay-sources", response_model=dict[str, list[ReplaySourceOption]], response_model_by_alias=False)
def list_replay_sources() -> dict[str, list[ReplaySourceOption]]:
    return {
        "items": [
            ReplaySourceOption(key="internal_match", label="Internal Match", enabled=True),
            ReplaySourceOption(key="upload_file", label="Upload File", enabled=True),
            ReplaySourceOption(key="inline_json", label="Inline JSON", enabled=True),
            ReplaySourceOption(key="tenhou_url", label="Tenhou URL", enabled=False),
            ReplaySourceOption(key="tenhou_id", label="Tenhou ID", enabled=False),
            ReplaySourceOption(key="majsoul_url", label="Majsoul URL", enabled=False),
        ]
    }


@app.post("/api/uploads", response_model=UploadResponse, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    settings.ensure_dirs()
    suffix = Path(file.filename or "").suffix
    relative_key = f"uploads/{uuid.uuid4()}{suffix}"
    file_path = settings.storage_dir / relative_key
    file_path.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with file_path.open("wb") as target:
        source = file.file
        source.seek(0)
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            target.write(chunk)

    return UploadResponse(file_key=relative_key, filename=file.filename or file_path.name, size=size)


@app.post("/api/review-jobs", response_model=ReviewJobOut, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
def create_review_job(payload: CreateReviewJobRequest, db: Session = Depends(get_db)) -> ReviewJobOut:
    user = get_or_create_default_user(db)
    source = payload.source or {}
    match_id = source.get("match_id") if payload.source_type == "internal_match" else None
    raw_input_object_key = source.get("file_key") if payload.source_type == "upload_file" else None

    job = ReviewJob(
        user_id=user.id,
        match_id=match_id,
        status="queued",
        progress=5,
        step="queued",
        source_type=payload.source_type,
        platform=payload.platform,
        source_payload=source,
        options_json=payload.options,
        target_player_ref=payload.target_player_ref,
        raw_input_object_key=raw_input_object_key,
        attempt_count=1,
        queued_at=utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    enqueue_review_job(job.id)
    return serialize_review_job(job)


@app.get("/api/review-jobs/{task_id}", response_model=ReviewJobOut, response_model_by_alias=False)
def get_review_job(task_id: str, db: Session = Depends(get_db)) -> ReviewJobOut:
    job = db.get(ReviewJob, task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="review job not found")
    return serialize_review_job(job)


@app.get("/api/review-jobs/{task_id}/result", response_model=ReviewJobResultOut, response_model_by_alias=False)
def get_review_job_result(task_id: str, db: Session = Depends(get_db)) -> ReviewJobResultOut:
    job = db.get(ReviewJob, task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="review job not found")

    report_url = f"/api/reviews/{job.review_id}" if job.review_id else None
    return ReviewJobResultOut(task_id=job.id, status=job.status, review_id=job.review_id, report_url=report_url)


@app.post("/api/review-jobs/{task_id}/retry", response_model=ReviewJobOut, response_model_by_alias=False)
def retry_review_job(task_id: str, db: Session = Depends(get_db)) -> ReviewJobOut:
    job = db.get(ReviewJob, task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="review job not found")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail="only failed jobs can be retried")

    job.status = "queued"
    job.progress = 5
    job.step = "queued"
    job.error_code = None
    job.error_message = None
    job.completed_at = None
    job.queued_at = utcnow()
    job.started_at = None
    job.attempt_count += 1
    db.commit()
    db.refresh(job)
    enqueue_review_job(job.id)
    return serialize_review_job(job)


@app.get("/api/reviews", response_model=PaginatedReviews, response_model_by_alias=False)
def list_reviews(
    q: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedReviews:
    stmt = select(Review)
    if platform and platform != "all":
        stmt = stmt.where(Review.platform == platform)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Review.target_player_label.ilike(like),
                Review.model_tag.ilike(like),
            ),
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    reviews = db.scalars(
        stmt.order_by(Review.created_at.desc()).offset((page - 1) * page_size).limit(page_size),
    ).all()
    return PaginatedReviews(
        items=[serialize_review(review) for review in reviews],
        page=page,
        page_size=page_size,
        total=int(total),
    )


@app.get("/api/reviews/{review_id}", response_model=ReviewOut, response_model_by_alias=False)
def get_review(review_id: str, db: Session = Depends(get_db)) -> ReviewOut:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="review not found")
    return serialize_review(review)


@app.get("/api/reviews/{review_id}/entries", response_model=PaginatedReviewEntries, response_model_by_alias=False)
def list_review_entries(
    review_id: str,
    kyoku: int | None = Query(default=None, ge=0),
    deviation_level: str | None = Query(default=None),
    decision_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginatedReviewEntries:
    if db.get(Review, review_id) is None:
        raise HTTPException(status_code=404, detail="review not found")

    stmt = select(ReviewEntry).where(ReviewEntry.review_id == review_id)
    if kyoku is not None:
        stmt = stmt.where(ReviewEntry.kyoku_index == kyoku)
    if deviation_level and deviation_level != "all":
        stmt = stmt.where(ReviewEntry.deviation_level == deviation_level)
    if decision_type and decision_type != "all":
        stmt = stmt.where(ReviewEntry.decision_type == decision_type)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    entries = db.scalars(
        stmt.order_by(ReviewEntry.seq.asc()).offset((page - 1) * page_size).limit(page_size),
    ).all()
    return PaginatedReviewEntries(
        items=[serialize_entry(entry) for entry in entries],
        page=page,
        page_size=page_size,
        total=int(total),
    )


@app.delete("/api/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(review_id: str, db: Session = Depends(get_db)) -> Response:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="review not found")

    file_path = settings.storage_dir / review.result_object_key
    job = db.get(ReviewJob, review.job_id)
    if job is not None:
        job.review_id = None
    db.delete(review)
    db.commit()
    if file_path.exists():
        file_path.unlink()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
