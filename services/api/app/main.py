from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .jobs import enqueue_review_job
from .models import Match, MatchEvent, Review, ReviewEntry, ReviewJob, User
from .play_launcher import MahjongAiLauncher
from .schemas import (
    CreatePlaySessionRequest,
    CreateReviewJobRequest,
    DashboardSummary,
    PaginatedPlayMatches,
    PlayMatchOut,
    PlaySessionOut,
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
play_launcher = MahjongAiLauncher(settings)

mahjong_ai_web_client_dir = settings.mahjong_ai_root / "online_game" / "web_client"
if mahjong_ai_web_client_dir.exists():
    app.mount(
        "/api/mahjong-ai-web",
        StaticFiles(directory=mahjong_ai_web_client_dir),
        name="mahjong_ai_web",
    )


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


def create_review_job_record(
    db: Session,
    *,
    user: User,
    source_type: str,
    platform: str | None,
    source: dict,
    options: dict,
    target_player_ref: str | None,
    match_id: str | None = None,
    raw_input_object_key: str | None = None,
) -> ReviewJob:
    job = ReviewJob(
        user_id=user.id,
        match_id=match_id,
        status="queued",
        progress=5,
        step="queued",
        source_type=source_type,
        platform=platform,
        source_payload=source,
        options_json=options,
        target_player_ref=target_player_ref,
        raw_input_object_key=raw_input_object_key,
        attempt_count=1,
        queued_at=utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    enqueue_review_job(job.id)
    return job


def get_internal_match_review_event_limit(db: Session, match: Match) -> int:
    total_event_count = db.scalar(select(func.count(MatchEvent.id)).where(MatchEvent.match_id == match.id)) or 0
    if total_event_count <= 0:
        return 0
    if match.status == "completed":
        return int(total_event_count)

    last_completed_kyoku_seq = db.scalar(
        select(func.max(MatchEvent.seq)).where(
            MatchEvent.match_id == match.id,
            MatchEvent.event_type == "end_kyoku",
        ),
    )
    if last_completed_kyoku_seq is None:
        return 0
    return int(last_completed_kyoku_seq) + 1


def serialize_play_match(db: Session, match: Match) -> PlayMatchOut:
    event_count = db.scalar(select(func.count(MatchEvent.id)).where(MatchEvent.match_id == match.id)) or 0
    completed_kyoku_count = (
        db.scalar(
            select(func.count(MatchEvent.id)).where(
                MatchEvent.match_id == match.id,
                MatchEvent.event_type == "end_kyoku",
            ),
        )
        or 0
    )
    last_completed_kyoku_seq = db.scalar(
        select(func.max(MatchEvent.seq)).where(
            MatchEvent.match_id == match.id,
            MatchEvent.event_type == "end_kyoku",
        ),
    )
    reviewable_event_count = int(event_count)
    if match.status != "completed":
        reviewable_event_count = int(last_completed_kyoku_seq) + 1 if last_completed_kyoku_seq is not None else 0

    latest_review_job = db.scalar(
        select(ReviewJob)
        .where(ReviewJob.match_id == match.id, ReviewJob.source_type == "internal_match")
        .order_by(ReviewJob.created_at.desc())
        .limit(1),
    )
    latest_review_event_count = None
    if latest_review_job is not None and isinstance(latest_review_job.source_payload, dict):
        source_event_limit = latest_review_job.source_payload.get("event_limit")
        if isinstance(source_event_limit, int):
            latest_review_event_count = source_event_limit

    source = match.source_json or {}
    target_actor = source.get("target_actor")
    if not isinstance(target_actor, int):
        target_actor = None
    target_player_label = source.get("target_player_label") or source.get("username")

    return PlayMatchOut(
        id=match.id,
        status=match.status,
        match_type=match.match_type,
        source=source,
        result=match.result_json,
        event_count=int(event_count),
        reviewable_event_count=reviewable_event_count,
        completed_kyoku_count=int(completed_kyoku_count),
        target_actor=target_actor,
        target_player_label=target_player_label if isinstance(target_player_label, str) else None,
        latest_review_job=(
            {
                "id": latest_review_job.id,
                "status": latest_review_job.status,
                "event_count": latest_review_event_count,
                "review_id": latest_review_job.review_id,
                "error_message": latest_review_job.error_message,
                "created_at": latest_review_job.created_at,
                "updated_at": latest_review_job.updated_at,
            }
            if latest_review_job is not None
            else None
        ),
        created_at=match.created_at,
        updated_at=match.updated_at,
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


@app.get("/api/play/session", response_model=PlaySessionOut | None, response_model_by_alias=False)
def get_play_session() -> PlaySessionOut | None:
    return play_launcher.get_status()


@app.post("/api/play/session", response_model=PlaySessionOut, response_model_by_alias=False)
def create_play_session(payload: CreatePlaySessionRequest) -> PlaySessionOut:
    try:
        return play_launcher.ensure_running(payload.username, payload.ai_level, payload.ai_opponents)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/play/matches", response_model=PaginatedPlayMatches, response_model_by_alias=False)
def list_play_matches(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedPlayMatches:
    user = get_or_create_default_user(db)
    stmt = select(Match).where(Match.user_id == user.id)
    if status_filter and status_filter != "all":
        if status_filter == "round_finished":
            stmt = stmt.where(
                or_(
                    Match.status == "round_finished",
                    and_(
                        Match.status == "running",
                        select(func.count(MatchEvent.id))
                        .where(MatchEvent.match_id == Match.id, MatchEvent.event_type == "end_kyoku")
                        .correlate(Match)
                        .scalar_subquery()
                        > 0,
                    ),
                ),
            )
        else:
            stmt = stmt.where(Match.status == status_filter)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Match.id.ilike(like), cast(Match.source_json, String).ilike(like)))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    matches = db.scalars(
        stmt.order_by(Match.created_at.desc()).offset((page - 1) * page_size).limit(page_size),
    ).all()
    return PaginatedPlayMatches(
        items=[serialize_play_match(db, match) for match in matches],
        page=page,
        page_size=page_size,
        total=int(total),
    )


@app.get("/api/play/matches/{match_id}", response_model=PlayMatchOut, response_model_by_alias=False)
def get_play_match(match_id: str) -> PlayMatchOut:
    match = play_launcher.get_match(match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="match not found")
    return match


@app.post("/api/play/matches/{match_id}/review", response_model=ReviewJobOut, response_model_by_alias=False)
def create_play_match_review(match_id: str, db: Session = Depends(get_db)) -> ReviewJobOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="match not found")

    event_limit = get_internal_match_review_event_limit(db, match)
    if event_limit <= 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="还没有已结算的小局可复盘")

    if match.status == "running":
        play_launcher.finish_active_match_for_review(match_id)
        match.status = "round_finished"
        db.commit()
        db.refresh(match)

    existing_jobs = db.scalars(
        select(ReviewJob)
        .where(ReviewJob.match_id == match_id, ReviewJob.source_type == "internal_match", ReviewJob.status != "failed")
        .order_by(ReviewJob.created_at.desc())
    ).all()
    for existing_job in existing_jobs:
        source_payload = existing_job.source_payload or {}
        if source_payload.get("event_limit") != event_limit:
            continue
        if existing_job.review_id:
            existing_review = db.get(Review, existing_job.review_id)
            if existing_review is not None and existing_review.engine_name == "mjai-reviewer-lite":
                continue
        return serialize_review_job(existing_job)

    user = get_or_create_default_user(db)
    source = match.source_json or {}
    target_actor = source.get("target_actor")
    target_player_ref = str(target_actor) if isinstance(target_actor, int) else "0"
    job = create_review_job_record(
        db,
        user=user,
        source_type="internal_match",
        platform="internal",
        source={"match_id": match_id, "event_limit": event_limit},
        options={"origin": "play_result", "snapshot_status": match.status},
        target_player_ref=target_player_ref,
        match_id=match_id,
    )
    return serialize_review_job(job)


@app.get("/api/play/matches/{match_id}/export")
def export_play_match(match_id: str) -> PlainTextResponse:
    try:
        content = play_launcher.export_match_events_jsonl(match_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PlainTextResponse(
        content=content,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="match-{match_id}.jsonl"'},
    )


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
            ReplaySourceOption(key="internal_match", label="平台内对局", enabled=True),
            ReplaySourceOption(key="upload_file", label="文件上传", enabled=True),
            ReplaySourceOption(key="inline_json", label="JSON 数据", enabled=True),
            ReplaySourceOption(key="tenhou_url", label="天凤链接", enabled=True),
            ReplaySourceOption(key="tenhou_id", label="天凤 ID", enabled=True),
            ReplaySourceOption(key="majsoul_file", label="雀魂导出文件", enabled=True),
            ReplaySourceOption(key="majsoul_url", label="雀魂链接", enabled=True),
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
    target_player_ref = payload.target_player_ref

    if payload.source_type == "internal_match":
        if not isinstance(match_id, str) or not match_id:
            raise HTTPException(status_code=400, detail="internal_match requires source.match_id")
        match = db.get(Match, match_id)
        if match is None:
            raise HTTPException(status_code=404, detail="match not found")
        target_actor = (match.source_json or {}).get("target_actor")
        if target_player_ref is None and isinstance(target_actor, int):
            target_player_ref = str(target_actor)

    job = create_review_job_record(
        db,
        user=user,
        source_type=payload.source_type,
        platform=payload.platform,
        source=source,
        options=payload.options,
        target_player_ref=target_player_ref,
        match_id=match_id if isinstance(match_id, str) else None,
        raw_input_object_key=raw_input_object_key,
    )
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
