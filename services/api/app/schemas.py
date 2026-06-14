from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class UploadResponse(BaseModel):
    file_key: str
    filename: str
    size: int


class ReplaySourceOption(BaseModel):
    key: str
    label: str
    enabled: bool


class UserProfile(BaseModel):
    id: str
    display_name: str
    locale: str
    timezone: str


class CreatePlaySessionRequest(BaseModel):
    username: str = Field(min_length=1, max_length=8)
    ai_level: Literal["normal", "hard"] = "normal"
    match_type: Literal["tonpu", "hanchan"] = "hanchan"
    seat: Literal["random", "east", "south", "west", "north"] = "random"
    start_points: int = Field(default=25000, ge=10000, le=50000, multiple_of=100)
    aka_dora: Literal[0, 3] = 3
    kuitan: bool = True
    allow_south_entry: bool = False
    ai_opponents: list[dict[str, Any]] = Field(default_factory=list)


class PlayServiceStatus(BaseModel):
    name: str
    host: str
    port: int
    running: bool
    reachable: bool
    managed: bool
    detail: str | None = None


class PlaySessionOut(BaseModel):
    session_id: str
    match_id: str
    username: str
    status: str
    host: str
    websocket_port: int
    web_port: int
    game_url: str
    launch_url: str
    services: list[PlayServiceStatus]


class PlayMatchReviewJobOut(BaseModel):
    id: str
    status: str
    event_count: int | None = None
    review_id: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class PlayMatchOut(BaseModel):
    id: str
    status: str
    match_type: str | None = None
    source: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    event_count: int = 0
    reviewable_event_count: int = 0
    completed_kyoku_count: int = 0
    target_actor: int | None = None
    target_player_label: str | None = None
    latest_review_job: PlayMatchReviewJobOut | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedPlayMatches(BaseModel):
    items: list[PlayMatchOut]
    page: int
    page_size: int
    total: int


class ClassicGameHandOut(BaseModel):
    index: int
    label: str
    scores: list[int] = Field(default_factory=list)
    decision_count: int


class ClassicGameOut(BaseModel):
    id: str
    title: str
    subtitle: str
    source: str
    year: int
    match_type: str
    players: list[str]
    tags: list[str]
    summary: str
    hand_count: int
    decision_count: int
    hands: list[ClassicGameHandOut] = Field(default_factory=list)


class CreateClassicTrainingSessionRequest(BaseModel):
    game_id: str = Field(min_length=1, max_length=80)
    start_hand_index: int = Field(default=0, ge=0)
    username: str = Field(default="训练玩家", min_length=1, max_length=8)


class ClassicTrainingActionRequest(BaseModel):
    type: Literal["dahai"]
    pai: str = Field(min_length=1, max_length=4)


class ClassicTrainingDecisionOut(BaseModel):
    decision_index: int
    total_decisions: int
    hand_index: int
    hand_label: str
    turn: int
    action_type: str
    state_snapshot: dict[str, Any]
    options: list[dict[str, Any]]


class ClassicTrainingComparisonOut(BaseModel):
    decision_index: int
    hand_index: int
    hand_label: str
    turn: int
    actual_action: dict[str, Any]
    original_action: dict[str, Any]
    is_same: bool


class ClassicTrainingHandSummaryOut(BaseModel):
    hand_index: int
    hand_label: str
    decision_count: int
    same_count: int
    different_count: int
    agreement_rate: float


class ClassicTrainingComparisonSummaryOut(BaseModel):
    decision_count: int
    same_count: int
    different_count: int
    agreement_rate: float
    route_label: str
    route_description: str
    hands: list[ClassicTrainingHandSummaryOut] = Field(default_factory=list)


class ClassicTrainingSessionOut(BaseModel):
    match_id: str
    status: str
    username: str
    game: ClassicGameOut
    start_hand_index: int
    answered_count: int
    total_decisions: int
    current_decision: ClassicTrainingDecisionOut | None = None
    history: list[ClassicTrainingComparisonOut] = Field(default_factory=list)
    comparison_summary: ClassicTrainingComparisonSummaryOut | None = None
    result: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


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


class ReviewAssistantMessageOut(BaseModel):
    id: str
    role: str
    content: str
    status: str
    model_provider: str | None = None
    model_name: str | None = None
    prompt_version: str | None = None
    context_hash: str
    latency_ms: int | None = None
    created_at: datetime
    feedback: str | None = None
    sources: dict[str, Any] | None = None


class ReviewAssistantConversationOut(BaseModel):
    id: str
    review_id: str
    entry_id: int
    context_version: str
    context_hash: str
    title: str
    provider_mode: str
    messages: list[ReviewAssistantMessageOut] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)


class ReviewAssistantMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    answer_mode: str = Field(default="concise", pattern="^(concise|deep)$")
    client_request_id: str = Field(min_length=1, max_length=64)


class ReviewAssistantFeedbackRequest(BaseModel):
    rating: str = Field(pattern="^(helpful|unhelpful|error)$")
    reason: str | None = Field(default=None, max_length=100)


class ReviewAssistantFeedbackOut(BaseModel):
    message_id: str
    rating: str
    reason: str | None = None
