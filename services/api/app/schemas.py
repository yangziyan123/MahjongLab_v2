from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UploadResponse(BaseModel):
    file_key: str
    filename: str
    size: int


class DashboardSummary(BaseModel):
    review_count: int
    completed_job_count: int
    failed_job_count: int


class ReplaySourceOption(BaseModel):
    key: str
    label: str
    enabled: bool


class UserProfile(BaseModel):
    id: str
    display_name: str
    locale: str
    timezone: str


class CreateReviewJobRequest(BaseModel):
    source_type: str
    platform: str | None = None
    source: dict[str, Any] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)
    target_player_ref: str | None = None


class ReviewJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    status: str
    progress: int
    step: str
    source_type: str
    platform: str | None = None
    source: dict[str, Any] = Field(default_factory=dict, alias="source_payload")
    options: dict[str, Any] = Field(default_factory=dict, alias="options_json")
    target_player_ref: str | None = None
    target_actor: int | None = None
    review_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    attempt_count: int
    created_at: datetime
    updated_at: datetime
    queued_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ReviewJobResultOut(BaseModel):
    task_id: str
    status: str
    review_id: str | None = None
    report_url: str | None = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    job_id: str
    platform: str | None = None
    target_actor: int
    target_player_label: str | None = None
    engine_name: str
    engine_version: str
    model_tag: str | None = None
    reviewed_decision_count: int
    match_decision_count: int
    high_deviation_count: int
    medium_deviation_count: int
    optimal_count: int
    rating: float | None = None
    temperature: float | None = None
    summary: dict[str, Any] = Field(default_factory=dict, alias="summary_json")
    stats: dict[str, Any] = Field(default_factory=dict, alias="stats_json")
    result_object_key: str
    created_at: datetime
    updated_at: datetime


class ReviewEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    review_id: str
    seq: int
    kyoku_index: int
    honba: int
    junme: int
    tiles_left: int
    last_actor: int | None = None
    tile: str | None = None
    decision_type: str
    actual_action: dict[str, Any] | None = Field(default=None, alias="actual_action_json")
    expected_action: dict[str, Any] = Field(default_factory=dict, alias="expected_action_json")
    is_match: bool
    deviation_level: str
    delta_score: float | None = None
    shanten: int | None = None
    at_furiten: bool | None = None
    details: list[dict[str, Any]] = Field(default_factory=list, alias="details_json")
    state_snapshot: dict[str, Any] = Field(default_factory=dict, alias="state_snapshot_json")
    tags: list[str] = Field(default_factory=list, alias="tags_json")
    created_at: datetime


class PaginatedReviews(BaseModel):
    items: list[ReviewOut]
    page: int
    page_size: int
    total: int


class PaginatedReviewEntries(BaseModel):
    items: list[ReviewEntryOut]
    page: int
    page_size: int
    total: int
