from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .jobs import enqueue_review_job
from .models import MistakeItem, Review, ReviewEntry, ReviewJob, User
from .schemas import (
    CreateMistakeItemRequest,
    CreateReviewJobRequest,
    DashboardSummary,
    MistakeItemOut,
    PaginatedMistakeItems,
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


def derive_mistake_category(tags: list[str], decision_type: str) -> str:
    priority = ["defense", "riichi_judgment", "call_judgment", "efficiency", "attack"]
    for candidate in priority:
        if candidate in tags:
            return candidate

    if decision_type == "riichi":
        return "riichi_judgment"
    if decision_type in {"chi", "pon", "kan"}:
        return "call_judgment"
    if decision_type == "discard":
        return "efficiency"
    return "other"


def build_mistake_snapshot(review: Review, entry: ReviewEntry) -> dict:
    return {
        "platform": review.platform,
        "target_actor": review.target_actor,
        "target_player_label": review.target_player_label,
        "entry_seq": entry.seq,
        "kyoku_index": entry.kyoku_index,
        "honba": entry.honba,
        "junme": entry.junme,
        "decision_type": entry.decision_type,
        "deviation_level": entry.deviation_level,
        "actual_action": entry.actual_action_json,
        "expected_action": entry.expected_action_json or {},
        "state_snapshot": entry.state_snapshot_json or {},
    }


def serialize_mistake(item: MistakeItem) -> MistakeItemOut:
    snapshot = item.snapshot_json or {}
    review = item.review
    entry = item.review_entry

    target_actor = review.target_actor if review is not None else int(snapshot.get("target_actor", 0))
    return MistakeItemOut(
        id=item.id,
        review_id=item.review_id,
        review_entry_id=item.review_entry_id,
        platform=review.platform if review is not None else snapshot.get("platform"),
        target_actor=target_actor,
        target_player_label=review.target_player_label if review is not None else snapshot.get("target_player_label"),
        entry_seq=entry.seq if entry is not None else int(snapshot.get("entry_seq", 0)),
        kyoku_index=entry.kyoku_index if entry is not None else int(snapshot.get("kyoku_index", 0)),
        honba=entry.honba if entry is not None else int(snapshot.get("honba", 0)),
        junme=entry.junme if entry is not None else int(snapshot.get("junme", 0)),
        decision_type=entry.decision_type if entry is not None else str(snapshot.get("decision_type", "other")),
        deviation_level=entry.deviation_level if entry is not None else str(snapshot.get("deviation_level", "medium")),
        category=item.category,
        note=item.note,
        tags=item.tags_json or [],
        actual_action=snapshot.get("actual_action"),
        expected_action=snapshot.get("expected_action") or {},
        state_snapshot=snapshot.get("state_snapshot") or {},
        created_at=item.created_at,
        updated_at=item.updated_at,
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
    mistake_count = db.scalar(select(func.count(MistakeItem.id))) or 0
    return DashboardSummary(
        review_count=int(review_count),
        completed_job_count=int(completed_job_count),
        failed_job_count=int(failed_job_count),
        mistake_count=int(mistake_count),
    )


@app.get("/api/platforms/replay-sources", response_model=dict[str, list[ReplaySourceOption]], response_model_by_alias=False)
def list_replay_sources() -> dict[str, list[ReplaySourceOption]]:
    return {
        "items": [
            ReplaySourceOption(key="internal_match", label="平台内对局", enabled=True),
            ReplaySourceOption(key="upload_file", label="文件上传", enabled=True),
            ReplaySourceOption(key="inline_json", label="JSON 数据", enabled=True),
            ReplaySourceOption(key="tenhou_url", label="天凤链接", enabled=True),
            ReplaySourceOption(key="tenhou_id", label="天凤 ID", enabled=True),
            ReplaySourceOption(key="majsoul_file", label="雀魂导出文件", enabled=True),
            ReplaySourceOption(key="majsoul_url", label="雀魂链接", enabled=False),
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
    raw_input_object_key = source.get("file_key") if payload.source_type in {"upload_file", "majsoul_file"} else None

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


@app.post("/api/reviews/{review_id}/mistakes", response_model=MistakeItemOut, status_code=status.HTTP_201_CREATED)
def create_mistake_item(
    review_id: str,
    payload: CreateMistakeItemRequest,
    db: Session = Depends(get_db),
) -> MistakeItemOut:
    user = get_or_create_default_user(db)
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="review not found")

    entry = db.get(ReviewEntry, payload.review_entry_id)
    if entry is None or entry.review_id != review_id:
        raise HTTPException(status_code=404, detail="review entry not found")
    if entry.deviation_level == "none" or entry.is_match:
        raise HTTPException(status_code=400, detail="only deviated review entries can be added to mistakes")

    existing = db.scalar(
        select(MistakeItem)
        .where(MistakeItem.user_id == user.id, MistakeItem.review_entry_id == entry.id)
        .options(joinedload(MistakeItem.review), joinedload(MistakeItem.review_entry)),
    )

    tags = sorted({*(entry.tags_json or []), *(payload.tags or [])})
    category = derive_mistake_category(tags, entry.decision_type)
    snapshot = build_mistake_snapshot(review, entry)

    if existing is None:
        existing = MistakeItem(
            user_id=user.id,
            review_id=review.id,
            review_entry_id=entry.id,
            category=category,
            note=payload.note,
            tags_json=tags,
            snapshot_json=snapshot,
        )
        db.add(existing)
    else:
        existing.category = category
        existing.note = payload.note if payload.note is not None else existing.note
        existing.tags_json = tags
        existing.snapshot_json = snapshot

    db.commit()
    db.refresh(existing)
    return serialize_mistake(existing)


@app.get("/api/mistakes", response_model=PaginatedMistakeItems, response_model_by_alias=False)
def list_mistake_items(
    q: str | None = Query(default=None),
    review_id: str | None = Query(default=None),
    category: str | None = Query(default=None),
    decision_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedMistakeItems:
    user = get_or_create_default_user(db)
    stmt = (
        select(MistakeItem)
        .where(MistakeItem.user_id == user.id)
        .join(Review, MistakeItem.review_id == Review.id)
        .join(ReviewEntry, MistakeItem.review_entry_id == ReviewEntry.id)
        .options(joinedload(MistakeItem.review), joinedload(MistakeItem.review_entry))
    )

    if review_id:
        stmt = stmt.where(MistakeItem.review_id == review_id)
    if category and category != "all":
        stmt = stmt.where(MistakeItem.category == category)
    if decision_type and decision_type != "all":
        stmt = stmt.where(ReviewEntry.decision_type == decision_type)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                MistakeItem.note.ilike(like),
                MistakeItem.category.ilike(like),
                Review.target_player_label.ilike(like),
            ),
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(MistakeItem.created_at.desc()).offset((page - 1) * page_size).limit(page_size),
    ).all()
    return PaginatedMistakeItems(
        items=[serialize_mistake(item) for item in items],
        page=page,
        page_size=page_size,
        total=int(total),
    )


@app.delete("/api/mistakes/{mistake_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mistake_item(mistake_id: str, db: Session = Depends(get_db)) -> Response:
    user = get_or_create_default_user(db)
    mistake = db.scalar(select(MistakeItem).where(MistakeItem.id == mistake_id, MistakeItem.user_id == user.id))
    if mistake is None:
        raise HTTPException(status_code=404, detail="mistake item not found")

    db.delete(mistake)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
