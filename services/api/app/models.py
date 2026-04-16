from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    locale: Mapped[str] = mapped_column(Text, nullable=False, default="zh-CN")
    timezone: Mapped[str] = mapped_column(Text, nullable=False, default="Asia/Shanghai")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    review_jobs: Mapped[list["ReviewJob"]] = relationship(back_populates="user")
    reviews: Mapped[list["Review"]] = relationship(back_populates="user")
    matches: Mapped[list["Match"]] = relationship(back_populates="user")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="created")
    match_type: Mapped[str] = mapped_column(Text, nullable=False, default="hanchan")
    source_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped[User] = relationship(back_populates="matches")
    events: Mapped[list["MatchEvent"]] = relationship(back_populates="match", cascade="all, delete-orphan")
    review_jobs: Mapped[list["ReviewJob"]] = relationship(back_populates="match")
    reviews: Mapped[list["Review"]] = relationship(back_populates="match")


class MatchEvent(Base):
    __tablename__ = "match_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[str] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    match: Mapped[Match] = relationship(back_populates="events")


class ReviewJob(Base):
    __tablename__ = "review_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[str | None] = mapped_column(ForeignKey("matches.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="created", index=True)
    progress: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    step: Mapped[str] = mapped_column(Text, nullable=False, default="created")
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    options_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    target_player_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_actor: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    review_id: Mapped[str | None] = mapped_column(ForeignKey("reviews.id"), nullable=True, index=True)
    raw_input_object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_mjai_object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="review_jobs")
    match: Mapped[Match | None] = relationship(back_populates="review_jobs")
    review: Mapped["Review | None"] = relationship(
        back_populates="job",
        foreign_keys="Review.job_id",
        uselist=False,
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(ForeignKey("review_jobs.id"), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[str | None] = mapped_column(ForeignKey("matches.id"), nullable=True, index=True)
    platform: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_actor: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    target_player_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    engine_name: Mapped[str] = mapped_column(Text, nullable=False, default="mortal")
    engine_version: Mapped[str] = mapped_column(Text, nullable=False, default="phase1-mvp")
    model_tag: Mapped[str | None] = mapped_column(Text, nullable=True)
    lang: Mapped[str] = mapped_column(Text, nullable=False, default="zh-CN")
    reviewed_decision_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    match_decision_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    high_deviation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    medium_deviation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    optimal_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    temperature: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    summary_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    stats_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    result_object_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped[User] = relationship(back_populates="reviews")
    match: Mapped[Match | None] = relationship(back_populates="reviews")
    job: Mapped[ReviewJob] = relationship(back_populates="review", foreign_keys=[job_id])
    entries: Mapped[list["ReviewEntry"]] = relationship(back_populates="review", cascade="all, delete-orphan")


class ReviewEntry(Base):
    __tablename__ = "review_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_id: Mapped[str] = mapped_column(ForeignKey("reviews.id"), nullable=False, index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    kyoku_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    honba: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    junme: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tiles_left: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_actor: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    tile: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_type: Mapped[str] = mapped_column(Text, nullable=False, default="other", index=True)
    actual_action_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expected_action_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deviation_level: Mapped[str] = mapped_column(Text, nullable=False, default="none", index=True)
    delta_score: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    shanten: Mapped[int | None] = mapped_column(Integer, nullable=True)
    at_furiten: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    details_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    state_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    tags_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    review: Mapped[Review] = relationship(back_populates="entries")
