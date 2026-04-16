from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import MatchEvent, ReviewJob

ACTIONABLE_TYPES = {"dahai", "reach", "chi", "pon", "daiminkan", "ankan", "kakan", "hora", "ryukyoku"}
BOUNDARY_TYPES = {"start_game", "start_kyoku", "end_kyoku", "end_game"}
DECISION_TYPE_MAP = {
    "dahai": "discard",
    "reach": "riichi",
    "chi": "chi",
    "pon": "pon",
    "daiminkan": "kan",
    "ankan": "kan",
    "kakan": "kan",
    "hora": "agari",
    "ryukyoku": "ryukyoku",
    "none": "pass",
}


class ReviewExecutionError(RuntimeError):
    pass


@dataclass(slots=True)
class ReviewEntryDraft:
    seq: int
    kyoku_index: int
    honba: int
    junme: int
    tiles_left: int
    last_actor: int | None
    tile: str | None
    decision_type: str
    actual_action: dict[str, Any] | None
    expected_action: dict[str, Any]
    is_match: bool
    deviation_level: str
    delta_score: float | None
    shanten: int | None
    at_furiten: bool | None
    details: list[dict[str, Any]]
    state_snapshot: dict[str, Any]
    tags: list[str]


@dataclass(slots=True)
class ReviewRunResult:
    target_actor: int
    engine_name: str
    engine_version: str
    model_tag: str | None
    rating: float
    summary: dict[str, Any]
    stats: dict[str, Any]
    entries: list[ReviewEntryDraft]
    raw_result: dict[str, Any]


def parse_json_line(line: str, label: str) -> dict[str, Any]:
    try:
        return json.loads(line)
    except json.JSONDecodeError as exc:
        raise ReviewExecutionError(f"failed to parse {label} JSON: {exc}") from exc


def load_events_from_file(file_path: Path) -> list[dict[str, Any]]:
    content = file_path.read_text(encoding="utf-8").strip()
    if not content:
        raise ReviewExecutionError(f"empty replay file: {file_path}")
    if content[0] == "[":
        payload = json.loads(content)
        if not isinstance(payload, list):
            raise ReviewExecutionError("expected JSON array replay payload")
        return payload
    if content[0] == "{":
        payload = json.loads(content)
        if "events" in payload and isinstance(payload["events"], list):
            return payload["events"]
        raise ReviewExecutionError("expected object payload with events field")
    return [json.loads(line) for line in content.splitlines() if line.strip()]


def load_events_for_job(db: Session, job: ReviewJob) -> list[dict[str, Any]]:
    source = job.source_payload or {}
    source_type = job.source_type

    if source_type == "inline_json":
        if isinstance(source.get("events"), list):
            return source["events"]
        if isinstance(source.get("jsonl"), str):
            return [json.loads(line) for line in source["jsonl"].splitlines() if line.strip()]
        raise ReviewExecutionError("inline_json source requires events or jsonl")

    if source_type == "upload_file":
        file_key = source.get("file_key")
        if not isinstance(file_key, str) or not file_key:
            raise ReviewExecutionError("upload_file source requires file_key")
        file_path = settings.storage_dir / file_key
        if not file_path.exists():
            raise ReviewExecutionError(f"upload file not found: {file_key}")
        return load_events_from_file(file_path)

    if source_type == "internal_match":
        match_id = source.get("match_id") or job.match_id
        if not isinstance(match_id, str) or not match_id:
            raise ReviewExecutionError("internal_match source requires match_id")
        stmt = select(MatchEvent).where(MatchEvent.match_id == match_id).order_by(MatchEvent.seq.asc())
        events = [row.payload_json for row in db.scalars(stmt).all()]
        if not events:
            raise ReviewExecutionError(f"no match events found for match_id={match_id}")
        return events

    if source_type in {"tenhou_url", "tenhou_id", "majsoul_url"}:
        raise ReviewExecutionError(f"{source_type} is not implemented in phase 1 MVP")

    raise ReviewExecutionError(f"unsupported source_type: {source_type}")


def determine_target_actor(job: ReviewJob) -> int:
    if job.target_actor is not None:
        return int(job.target_actor)
    if job.target_player_ref is None:
        return 0
    try:
        return int(job.target_player_ref)
    except ValueError:
        return 0


def run_mortal_review(events: list[dict[str, Any]], target_actor: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not settings.mortal_entry.exists():
        raise ReviewExecutionError(f"mortal entry not found: {settings.mortal_entry}")
    if not settings.mortal_cfg.exists():
        raise ReviewExecutionError(f"mortal config not found: {settings.mortal_cfg}")

    env = os.environ.copy()
    env["MORTAL_REVIEW_MODE"] = "1"
    env["MORTAL_CFG"] = str(settings.mortal_cfg)

    process = subprocess.Popen(
        [settings.mortal_python, str(settings.mortal_entry), str(target_actor)],
        cwd=settings.mortal_dir,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=env,
    )

    outputs: list[dict[str, Any]] = []
    try:
        assert process.stdin is not None
        assert process.stdout is not None

        for event in events:
            process.stdin.write(json.dumps(event, ensure_ascii=False) + "\n")
            process.stdin.flush()
            line = process.stdout.readline()
            if not line:
                stderr = process.stderr.read() if process.stderr else ""
                raise ReviewExecutionError(f"mortal terminated unexpectedly: {stderr.strip()}")
            outputs.append(parse_json_line(line, "mortal event output"))

        process.stdin.close()

        extra_line = process.stdout.readline()
        stderr_text = process.stderr.read() if process.stderr else ""
        return_code = process.wait(timeout=120)
        if return_code != 0:
            raise ReviewExecutionError(stderr_text.strip() or f"mortal exited with code {return_code}")
        if not extra_line:
            raise ReviewExecutionError("mortal review mode did not emit final extra data")

        extra_data = parse_json_line(extra_line, "mortal extra output")
        return outputs, extra_data
    finally:
        if process.poll() is None:
            process.kill()


def next_actual_action(events: list[dict[str, Any]], start_index: int, target_actor: int) -> dict[str, Any] | None:
    for event in events[start_index + 1 :]:
        event_type = event.get("type")
        if event_type in BOUNDARY_TYPES:
            return None
        if event_type in ACTIONABLE_TYPES and event.get("actor") == target_actor:
            return event
    return None


def action_matches(expected: dict[str, Any], actual: dict[str, Any] | None) -> bool:
    if actual is None:
        return expected.get("type") in {"none", "ryukyoku"}

    expected_type = expected.get("type")
    actual_type = actual.get("type")
    if expected_type != actual_type:
        return False

    if expected_type in {"reach", "hora", "ryukyoku", "none"}:
        return True

    if expected_type in {"dahai", "kakan"}:
        return expected.get("pai") == actual.get("pai")

    if expected_type in {"chi", "pon", "daiminkan", "ankan"}:
        return expected.get("pai") == actual.get("pai") and sorted(expected.get("consumed", [])) == sorted(
            actual.get("consumed", []),
        )

    return expected == actual


def count_mask_bits(mask_bits: Any) -> int:
    try:
        return int(mask_bits).bit_count()
    except (TypeError, ValueError):
        return 0


def build_review(
    events: list[dict[str, Any]],
    outputs: list[dict[str, Any]],
    extra_data: dict[str, Any],
    target_actor: int,
) -> ReviewRunResult:
    entries: list[ReviewEntryDraft] = []
    kyoku_index = -1
    honba = 0
    junme = 0
    tiles_left = 70
    last_actor: int | None = None
    last_tile: str | None = None

    for index, event in enumerate(events):
        event_type = event.get("type")
        if event_type == "start_kyoku":
            kyoku_index += 1
            honba = int(event.get("honba", 0))
            junme = 0
            tiles_left = 70
            last_actor = None
            last_tile = None
            continue
        if event_type in {"end_kyoku", "end_game", "start_game"}:
            continue

        actor = event.get("actor")
        if event_type == "tsumo" and actor == target_actor:
            junme += 1
            tiles_left = max(0, tiles_left - 1)
            last_actor = actor
            last_tile = event.get("pai")
        elif actor is not None:
            last_actor = actor
            last_tile = event.get("pai")

        output = outputs[index]
        meta = output.get("meta")
        if not meta or count_mask_bits(meta.get("mask_bits")) <= 1:
            continue

        expected_action = {key: value for key, value in output.items() if key != "meta"}
        actual_action = next_actual_action(events, index, target_actor)
        is_match = action_matches(expected_action, actual_action)
        deviation_level = "none" if is_match else "medium"
        decision_type = DECISION_TYPE_MAP.get(expected_action.get("type"), "other")
        q_values = meta.get("q_values", []) or []
        best_q_value = float(max(q_values)) if q_values else None

        entries.append(
            ReviewEntryDraft(
                seq=len(entries),
                kyoku_index=max(kyoku_index, 0),
                honba=honba,
                junme=junme,
                tiles_left=tiles_left,
                last_actor=last_actor,
                tile=last_tile,
                decision_type=decision_type,
                actual_action=actual_action,
                expected_action=expected_action,
                is_match=is_match,
                deviation_level=deviation_level,
                delta_score=None if is_match else 0.0,
                shanten=meta.get("shanten"),
                at_furiten=meta.get("at_furiten"),
                details=[
                    {
                        "expected_action": expected_action,
                        "best_q_value": best_q_value,
                        "prob": 1.0,
                        "engine_meta": meta,
                    }
                ],
                state_snapshot={
                    "trigger_event": event,
                    "target_actor": target_actor,
                },
                tags=[],
            ),
        )

    reviewed_decision_count = len(entries)
    optimal_count = sum(1 for entry in entries if entry.is_match)
    medium_deviation_count = reviewed_decision_count - optimal_count
    high_deviation_count = 0
    rating = optimal_count / reviewed_decision_count if reviewed_decision_count else 0.0

    summary = {
        "target_actor": target_actor,
        "reviewed_decision_count": reviewed_decision_count,
        "match_decision_count": optimal_count,
        "optimal_count": optimal_count,
        "medium_deviation_count": medium_deviation_count,
        "high_deviation_count": high_deviation_count,
        "rating": rating,
    }
    stats = {
        "rating": rating,
        "phi_matrix": extra_data.get("phi_matrix", []),
    }
    raw_result = {
        "summary": summary,
        "stats": stats,
        "entries": [
            {
                "seq": entry.seq,
                "kyoku_index": entry.kyoku_index,
                "honba": entry.honba,
                "junme": entry.junme,
                "tiles_left": entry.tiles_left,
                "last_actor": entry.last_actor,
                "tile": entry.tile,
                "decision_type": entry.decision_type,
                "actual_action": entry.actual_action,
                "expected_action": entry.expected_action,
                "is_match": entry.is_match,
                "deviation_level": entry.deviation_level,
                "delta_score": entry.delta_score,
                "shanten": entry.shanten,
                "at_furiten": entry.at_furiten,
                "details": entry.details,
                "state_snapshot": entry.state_snapshot,
                "tags": entry.tags,
            }
            for entry in entries
        ],
        "engine": {
            "name": "mortal",
            "version": "phase1-mvp",
            "model_tag": extra_data.get("model_tag"),
        },
    }

    return ReviewRunResult(
        target_actor=target_actor,
        engine_name="mortal",
        engine_version="phase1-mvp",
        model_tag=extra_data.get("model_tag"),
        rating=rating,
        summary=summary,
        stats=stats,
        entries=entries,
        raw_result=raw_result,
    )


def execute_review_job(db: Session, job: ReviewJob) -> ReviewRunResult:
    events = load_events_for_job(db, job)
    target_actor = determine_target_actor(job)
    job.target_actor = target_actor
    outputs, extra_data = run_mortal_review(events, target_actor)
    return build_review(events, outputs, extra_data, target_actor)
