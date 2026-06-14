from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

EXPLANATION_VERSION = "decision-explanation.v1"
CONVERSATION_ANSWER_VERSION = "conversation-answer.v1"


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[TEDL][1-9][0-9]*$")
    kind: Literal["table", "engine", "derived", "limitation"]
    statement: str = Field(min_length=1, max_length=500)
    data: dict[str, Any] = Field(default_factory=dict)


class EvidenceClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim: str = Field(min_length=1, max_length=300)
    evidence_ids: list[str] = Field(min_length=1, max_length=6)


class ActionComparison(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: Literal["efficiency", "speed", "value", "defense", "flexibility", "placement"]
    actual_effect: str = Field(min_length=1, max_length=240)
    recommended_effect: str = Field(min_length=1, max_length=240)
    evidence_ids: list[str] = Field(min_length=1, max_length=6)


class DecisionExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["decision-explanation.v1"] = EXPLANATION_VERSION
    recommended_action: str = Field(min_length=1, max_length=80)
    actual_action: str = Field(min_length=1, max_length=80)
    verdict: str = Field(min_length=1, max_length=300)
    key_points: list[EvidenceClaim] = Field(min_length=1, max_length=3)
    comparison: list[ActionComparison] = Field(default_factory=list, max_length=4)
    uncertainties: list[EvidenceClaim] = Field(default_factory=list, max_length=4)
    teaching_rule: str = Field(min_length=1, max_length=300)
    confidence: Literal["high", "medium", "low"]


class ConversationAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["conversation-answer.v1"] = CONVERSATION_ANSWER_VERSION
    answer: str = Field(min_length=1, max_length=1200)
    evidence_ids: list[str] = Field(default_factory=list, max_length=12)
    uncertainty_ids: list[str] = Field(default_factory=list, max_length=8)
