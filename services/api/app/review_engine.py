from __future__ import annotations

import json
import locale
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .majsoul_url_import import MajsoulUrlImportError, download_majsoul_log_from_url
from .models import MatchEvent, ReviewJob

ACTIONABLE_TYPES = {"dahai", "reach", "chi", "pon", "daiminkan", "ankan", "kakan", "hora", "ryukyoku"}
BOUNDARY_TYPES = {"start_game", "start_kyoku", "end_kyoku", "end_game"}
TENHOU_HOSTS = {"tenhou.net", "www.tenhou.net"}
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


def decode_text_bytes(data: bytes | str | None) -> str:
    if data is None:
        return ""
    if isinstance(data, str):
        return data
    if not data:
        return ""

    preferred_encoding = locale.getpreferredencoding(False)
    encodings = ["utf-8-sig", preferred_encoding, "gb18030", "cp936"]
    seen: set[str] = set()
    for encoding in encodings:
        normalized = encoding.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        try:
            return data.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return data.decode("utf-8", errors="replace")


def read_text_compat(file_path: Path) -> str:
    try:
        return file_path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return decode_text_bytes(file_path.read_bytes())


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


def build_storage_artifact(prefix: str, filename: str) -> tuple[str, Path]:
    object_key = f"{prefix}/{filename}"
    file_path = settings.storage_dir / object_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    return object_key, file_path


def parse_tenhou_log_payload(body: str, log_id: str) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ReviewExecutionError(f"failed to parse downloaded Tenhou log {log_id}: {exc}") from exc

    if not isinstance(payload, dict):
        raise ReviewExecutionError(f"downloaded Tenhou log {log_id} is not a JSON object")

    logs = payload.get("log")
    if not isinstance(logs, list) or not logs:
        raise ReviewExecutionError(f"downloaded Tenhou log {log_id} does not contain any kyoku data")

    return payload


def is_tenhou_sanma_log(payload: dict[str, Any]) -> bool:
    logs = payload.get("log")
    if not isinstance(logs, list):
        return False

    for kyoku in logs:
        if not isinstance(kyoku, list):
            continue

        if len(kyoku) >= 16 and kyoku[13] == [] and kyoku[14] == [] and kyoku[15] == []:
            return True

        scoreboard = kyoku[1] if len(kyoku) > 1 else None
        if isinstance(scoreboard, list) and len(scoreboard) == 4 and scoreboard[3] == 0:
            return True

    return False


def validate_tenhou_log_payload(payload: dict[str, Any], log_id: str) -> None:
    if is_tenhou_sanma_log(payload):
        raise ReviewExecutionError(
            f"Tenhou sanma log {log_id} is not supported yet; current review pipeline only supports four-player games",
        )


def parse_tenhou_url(url_text: str) -> tuple[str, int | None]:
    parsed = urlparse(url_text)
    if parsed.scheme not in {"http", "https"}:
        raise ReviewExecutionError("tenhou_url must start with http:// or https://")

    host = parsed.hostname or ""
    if host not in TENHOU_HOSTS:
        raise ReviewExecutionError("tenhou_url must point to tenhou.net")

    query = parse_qs(parsed.query)
    log_values = query.get("log", [])
    if not log_values or not log_values[0].strip():
        raise ReviewExecutionError("tenhou_url does not contain a valid log parameter")

    actor: int | None = None
    tw_values = query.get("tw", [])
    if tw_values:
        try:
            actor = int(tw_values[0])
        except ValueError as exc:
            raise ReviewExecutionError("tenhou_url contains an invalid tw parameter") from exc
        if actor not in {0, 1, 2, 3}:
            raise ReviewExecutionError("tenhou_url tw parameter must be within 0-3")

    return log_values[0].strip(), actor


def resolve_tenhou_source(job: ReviewJob) -> tuple[str, int | None]:
    source = job.source_payload or {}

    if job.source_type == "tenhou_id":
        tenhou_id = source.get("id") or source.get("tenhou_id") or source.get("log_id")
        if not isinstance(tenhou_id, str) or not tenhou_id.strip():
            raise ReviewExecutionError("tenhou_id source requires a non-empty id")
        tenhou_id = tenhou_id.strip()
        return tenhou_id, None

    if job.source_type != "tenhou_url":
        raise ReviewExecutionError(f"unsupported tenhou source_type: {job.source_type}")

    tenhou_url = source.get("url")
    if not isinstance(tenhou_url, str) or not tenhou_url.strip():
        raise ReviewExecutionError("tenhou_url source requires a non-empty url")

    log_id, actor = parse_tenhou_url(tenhou_url.strip())
    return log_id, actor


def download_tenhou_log(log_id: str, target_path: Path) -> dict[str, Any]:
    request = Request(
        url=f"https://tenhou.net/5/mjlog2json.cgi?{log_id}",
        headers={
            "Referer": "https://tenhou.net/",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        raise ReviewExecutionError(f"failed to download Tenhou log {log_id}: HTTP {exc.code}") from exc
    except URLError as exc:
        raise ReviewExecutionError(f"failed to download Tenhou log {log_id}: {exc.reason}") from exc

    if not body.strip():
        raise ReviewExecutionError(f"downloaded Tenhou log {log_id} is empty")

    payload = parse_tenhou_log_payload(body, log_id)
    validate_tenhou_log_payload(payload, log_id)
    target_path.write_text(body, encoding="utf-8")
    return payload


def summarize_process_output(stdout: str, stderr: str, max_lines: int = 20) -> str:
    chunks = [chunk.strip() for chunk in (stderr, stdout) if chunk and chunk.strip()]
    if not chunks:
        return "command failed without stdout/stderr output"

    lines = "\n".join(chunks).splitlines()
    return "\n".join(lines[-max_lines:])


def convert_external_log_to_mjai(raw_path: Path, normalized_path: Path, source_label: str) -> None:
    command = [
        settings.cargo_bin,
        "run",
        "--manifest-path",
        str(settings.mjai_reviewer_manifest),
        "--",
        "--no-review",
        "--in-file",
        str(raw_path),
        "--mjai-out",
        str(normalized_path),
    ]

    try:
        process = subprocess.run(
            command,
            cwd=settings.repo_root,
            capture_output=True,
            timeout=300,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ReviewExecutionError(f"cargo executable not found; {source_label} import requires Rust tooling") from exc
    except subprocess.TimeoutExpired as exc:
        raise ReviewExecutionError(f"{source_label} import timed out while converting to mjai") from exc

    if process.returncode != 0:
        stdout = decode_text_bytes(process.stdout)
        stderr = decode_text_bytes(process.stderr)
        raise ReviewExecutionError(
            f"failed to convert {source_label} log to mjai:\n" + summarize_process_output(stdout, stderr),
        )


def ensure_tenhou_artifacts(db: Session, job: ReviewJob) -> Path:
    log_id, actor_from_url = resolve_tenhou_source(job)

    if not settings.mjai_reviewer_manifest.exists():
        raise ReviewExecutionError(f"mjai-reviewer manifest not found: {settings.mjai_reviewer_manifest}")

    source_payload = dict(job.source_payload or {})
    source_payload["resolved_log_id"] = log_id
    if actor_from_url is not None:
        source_payload["resolved_tw"] = actor_from_url
        if not job.target_player_ref:
            job.target_player_ref = str(actor_from_url)
    job.source_payload = source_payload

    raw_key = job.raw_input_object_key or build_storage_artifact("sources/tenhou", f"{job.id}.json")[0]
    normalized_key = job.normalized_mjai_object_key or build_storage_artifact("normalized/tenhou", f"{job.id}.jsonl")[0]
    raw_path = settings.storage_dir / raw_key
    normalized_path = settings.storage_dir / normalized_key

    if raw_path.exists() and normalized_path.exists():
        job.raw_input_object_key = raw_key
        job.normalized_mjai_object_key = normalized_key
        db.commit()
        return normalized_path

    raw_path.parent.mkdir(parents=True, exist_ok=True)
    normalized_path.parent.mkdir(parents=True, exist_ok=True)
    download_tenhou_log(log_id, raw_path)
    convert_external_log_to_mjai(raw_path, normalized_path, "Tenhou")

    if not raw_path.exists():
        raise ReviewExecutionError("Tenhou import finished but raw log file was not created")
    if not normalized_path.exists():
        raise ReviewExecutionError("Tenhou import finished but normalized mjai file was not created")

    job.raw_input_object_key = raw_key
    job.normalized_mjai_object_key = normalized_key
    db.commit()
    return normalized_path


def ensure_majsoul_file_artifacts(db: Session, job: ReviewJob) -> Path:
    if not settings.mjai_reviewer_manifest.exists():
        raise ReviewExecutionError(f"mjai-reviewer manifest not found: {settings.mjai_reviewer_manifest}")

    source = job.source_payload or {}
    file_key = source.get("file_key") or job.raw_input_object_key
    if not isinstance(file_key, str) or not file_key:
        raise ReviewExecutionError("majsoul_file source requires file_key")

    raw_path = settings.storage_dir / file_key
    if not raw_path.exists():
        raise ReviewExecutionError(f"majsoul export file not found: {file_key}")

    normalized_key = job.normalized_mjai_object_key or build_storage_artifact("normalized/majsoul", f"{job.id}.jsonl")[0]
    normalized_path = settings.storage_dir / normalized_key
    if normalized_path.exists():
        job.raw_input_object_key = file_key
        job.normalized_mjai_object_key = normalized_key
        db.commit()
        return normalized_path

    normalized_path.parent.mkdir(parents=True, exist_ok=True)
    convert_external_log_to_mjai(raw_path, normalized_path, "Majsoul")

    if not normalized_path.exists():
        raise ReviewExecutionError("Majsoul import finished but normalized mjai file was not created")

    job.raw_input_object_key = file_key
    job.normalized_mjai_object_key = normalized_key
    db.commit()
    return normalized_path


def ensure_majsoul_url_artifacts(db: Session, job: ReviewJob) -> Path:
    if not settings.mjai_reviewer_manifest.exists():
        raise ReviewExecutionError(f"mjai-reviewer manifest not found: {settings.mjai_reviewer_manifest}")

    source = dict(job.source_payload or {})
    majsoul_url = source.get("url")
    if not isinstance(majsoul_url, str) or not majsoul_url.strip():
        raise ReviewExecutionError("majsoul_url source requires a non-empty url")

    raw_key = job.raw_input_object_key or build_storage_artifact("sources/majsoul", f"{job.id}.json")[0]
    normalized_key = job.normalized_mjai_object_key or build_storage_artifact("normalized/majsoul", f"{job.id}.jsonl")[0]
    raw_path = settings.storage_dir / raw_key
    normalized_path = settings.storage_dir / normalized_key

    if raw_path.exists() and normalized_path.exists():
        job.raw_input_object_key = raw_key
        job.normalized_mjai_object_key = normalized_key
        db.commit()
        return normalized_path

    raw_path.parent.mkdir(parents=True, exist_ok=True)
    normalized_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        resolved_game_uuid = download_majsoul_log_from_url(majsoul_url.strip(), raw_path)
    except MajsoulUrlImportError as exc:
        raise ReviewExecutionError(str(exc)) from exc

    convert_external_log_to_mjai(raw_path, normalized_path, "Majsoul")

    if not normalized_path.exists():
        raise ReviewExecutionError("Majsoul import finished but normalized mjai file was not created")

    source["resolved_game_uuid"] = resolved_game_uuid
    job.source_payload = source
    job.raw_input_object_key = raw_key
    job.normalized_mjai_object_key = normalized_key
    db.commit()
    return normalized_path


def validate_explicit_majsoul_target_actor(job: ReviewJob) -> int:
    if job.target_actor is not None:
        actor = int(job.target_actor)
    else:
        if job.target_player_ref is None:
            raise ReviewExecutionError(
                "majsoul imports require target_player_ref because player seat cannot be auto-detected yet",
            )
        try:
            actor = int(job.target_player_ref)
        except ValueError as exc:
            raise ReviewExecutionError("majsoul target_player_ref must be an integer within 0-3") from exc

    if actor not in {0, 1, 2, 3}:
        raise ReviewExecutionError("majsoul target_player_ref must be within 0-3")
    return actor


def load_events_from_file(file_path: Path) -> list[dict[str, Any]]:
    content = read_text_compat(file_path).strip()
    if not content:
        raise ReviewExecutionError(f"empty replay file: {file_path}")
    if content[0] == "[":
        payload = json.loads(content)
        if not isinstance(payload, list):
            raise ReviewExecutionError("expected JSON array replay payload")
        return payload
    if content[0] == "{":
        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            return [json.loads(line) for line in content.splitlines() if line.strip()]
        if "events" in payload and isinstance(payload["events"], list):
            return payload["events"]
        if "type" in payload:
            return [payload]
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
        event_limit = source.get("event_limit")
        if isinstance(event_limit, int):
            if event_limit <= 0:
                raise ReviewExecutionError("internal_match event_limit must be positive")
            stmt = stmt.limit(event_limit)
        events = [row.payload_json for row in db.scalars(stmt).all()]
        if not events:
            raise ReviewExecutionError(f"no match events found for match_id={match_id}")
        return normalize_internal_match_events_for_mjai(events)

    if source_type in {"tenhou_url", "tenhou_id"}:
        normalized_path = ensure_tenhou_artifacts(db, job)
        return load_events_from_file(normalized_path)

    if source_type == "majsoul_file":
        normalized_path = ensure_majsoul_file_artifacts(db, job)
        return load_events_from_file(normalized_path)

    if source_type == "majsoul_url":
        normalized_path = ensure_majsoul_url_artifacts(db, job)
        return load_events_from_file(normalized_path)

    raise ReviewExecutionError(f"unsupported source_type: {source_type}")


def determine_target_actor(job: ReviewJob) -> int:
    if job.source_type in {"majsoul_file", "majsoul_url"}:
        return validate_explicit_majsoul_target_actor(job)

    if job.target_actor is not None:
        return int(job.target_actor)
    if job.target_player_ref is None:
        return 0
    try:
        return int(job.target_player_ref)
    except ValueError:
        return 0


def normalize_actor(value: Any) -> int | None:
    try:
        actor = int(value)
    except (TypeError, ValueError):
        return None
    return actor if actor in {0, 1, 2, 3} else None


def normalize_tile_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(tile) for tile in value if tile is not None]


def normalize_four_tile_lists(value: Any) -> list[list[str]]:
    hands = [[], [], [], []]
    if not isinstance(value, list):
        return hands
    for index, tiles in enumerate(value[:4]):
        hands[index] = normalize_tile_list(tiles)
    return hands


def normalize_dora_markers(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(tile) for tile in value if tile is not None]
    if isinstance(value, str):
        return [value]
    return []


def normalize_start_kyoku_event_for_mjai(event: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    normalized = dict(event)

    dora_markers = normalize_dora_markers(normalized.get("dora_marker"))
    if dora_markers:
        normalized["dora_marker"] = dora_markers[0]
    elif "dora_marker" not in normalized:
        normalized["dora_marker"] = "?"

    scores = normalized.get("scores")
    if isinstance(scores, list):
        fixed_scores = []
        for score in scores[:4]:
            try:
                fixed_scores.append(int(score))
            except (TypeError, ValueError):
                fixed_scores.append(25000)
    else:
        fixed_scores = []
    while len(fixed_scores) < 4:
        fixed_scores.append(25000)
    normalized["scores"] = fixed_scores

    synthetic_events: list[dict[str, Any]] = []
    tehais = normalized.get("tehais")
    fixed_hands: list[list[str]] = []
    if isinstance(tehais, list):
        source_hands = tehais[:4]
    else:
        source_hands = []
    while len(source_hands) < 4:
        source_hands.append([])

    for actor, hand in enumerate(source_hands):
        tiles = normalize_tile_list(hand)
        if len(tiles) > 13:
            synthetic_events.append({"type": "tsumo", "actor": actor, "pai": tiles[13]})
        fixed_hands.append((tiles + ["?"] * 13)[:13])
    normalized["tehais"] = fixed_hands

    return normalized, synthetic_events


def normalize_internal_match_events_for_mjai(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_events: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        if event.get("type") != "start_kyoku":
            if event.get("type") in {"hora", "ryukyoku"} and event.get("deltas") is None:
                normalized_events.append({**event, "deltas": [0, 0, 0, 0]})
            else:
                normalized_events.append(event)
            continue

        normalized, synthetic_events = normalize_start_kyoku_event_for_mjai(event)
        normalized_events.append(normalized)

        next_event = events[index + 1] if index + 1 < len(events) else None
        for synthetic_event in synthetic_events:
            if (
                isinstance(next_event, dict)
                and next_event.get("type") == "tsumo"
                and next_event.get("actor") == synthetic_event["actor"]
                and str(next_event.get("pai")) == synthetic_event["pai"]
            ):
                continue
            normalized_events.append(synthetic_event)
    return normalized_events


def same_tile_family(left: str, right: str) -> bool:
    return left.replace("r", "") == right.replace("r", "")


def remove_tile_once(tiles: list[str], tile: str | None) -> None:
    if not tile:
        return
    try:
        tiles.remove(tile)
        return
    except ValueError:
        pass
    for index, candidate in enumerate(tiles):
        if same_tile_family(candidate, tile):
            tiles.pop(index)
            return
    if "?" in tiles:
        tiles.remove("?")


def remove_tile_from_end(tiles: list[str], tile: str | None) -> None:
    if not tile:
        return
    for index in range(len(tiles) - 1, -1, -1):
        if tiles[index] == tile:
            tiles.pop(index)
            return
    for index in range(len(tiles) - 1, -1, -1):
        if same_tile_family(tiles[index], tile):
            tiles.pop(index)
            return
    if "?" in tiles:
        tiles.remove("?")


def remove_tiles(tiles: list[str], removed: list[str]) -> None:
    for tile in removed:
        remove_tile_once(tiles, tile)


def kyoku_to_index(bakaze: str, kyoku: int) -> int:
    wind_offset = {"E": 0, "S": 4, "W": 8, "N": 12}.get(bakaze, 0)
    return wind_offset + max(kyoku - 1, 0)


class ReviewTableState:
    def __init__(self, target_actor: int) -> None:
        self.target_actor = target_actor
        self.bakaze = "E"
        self.kyoku = 1
        self.honba = 0
        self.kyotaku = 0
        self.oya = 0
        self.scores = [25000, 25000, 25000, 25000]
        self.dora_markers: list[str] = []
        self.hands: list[list[str]] = [[], [], [], []]
        self.drawn_tiles: list[str | None] = [None, None, None, None]
        self.discards: list[list[dict[str, Any]]] = [[], [], [], []]
        self.melds: list[list[dict[str, Any]]] = [[], [], [], []]
        self.riichi: list[bool] = [False, False, False, False]
        self.pending_riichi: set[int] = set()
        self.tiles_left = 70
        self.last_event: dict[str, Any] | None = None
        self.last_actor: int | None = None
        self.last_tile: str | None = None

    def apply(self, event: dict[str, Any]) -> None:
        event_type = event.get("type")
        actor = normalize_actor(event.get("actor"))
        tile = event.get("pai") if isinstance(event.get("pai"), str) else None
        self.last_event = event
        if actor is not None:
            self.last_actor = actor
        if tile is not None:
            self.last_tile = tile

        if event_type == "start_kyoku":
            self.bakaze = str(event.get("bakaze") or "E")
            self.kyoku = int(event.get("kyoku", kyoku_to_index(self.bakaze, 1) + 1) or 1)
            self.honba = int(event.get("honba", 0) or 0)
            self.kyotaku = int(event.get("kyotaku", 0) or 0)
            self.oya = normalize_actor(event.get("oya")) or 0
            scores = event.get("scores")
            if isinstance(scores, list) and len(scores) >= 4:
                self.scores = [int(score) for score in scores[:4]]
            self.dora_markers = normalize_dora_markers(event.get("dora_marker"))
            self.hands = normalize_four_tile_lists(event.get("tehais"))
            self.drawn_tiles = [None, None, None, None]
            self.discards = [[], [], [], []]
            self.melds = [[], [], [], []]
            self.riichi = [False, False, False, False]
            self.pending_riichi = set()
            self.tiles_left = 70
            return

        if event_type == "dora":
            self.dora_markers.extend(normalize_dora_markers(event.get("dora_marker")))
            return

        if actor is None:
            if event_type in {"hora", "ryukyoku", "end_game"}:
                self.apply_score_update(event)
            return

        if event_type == "tsumo":
            draw_tile = tile or "?"
            self.drawn_tiles[actor] = draw_tile
            self.hands[actor].append(draw_tile)
            self.tiles_left = max(0, self.tiles_left - 1)
            return

        if event_type == "dahai":
            discard_tile = tile or self.drawn_tiles[actor] or "?"
            if self.drawn_tiles[actor] is not None and same_tile_family(self.drawn_tiles[actor] or "", discard_tile):
                remove_tile_from_end(self.hands[actor], discard_tile)
                self.drawn_tiles[actor] = None
            else:
                remove_tile_once(self.hands[actor], discard_tile)
            riichi_discard = actor in self.pending_riichi
            self.discards[actor].append(
                {
                    "pai": discard_tile,
                    "tsumogiri": bool(event.get("tsumogiri", False)),
                    "riichi": riichi_discard,
                    "called": False,
                },
            )
            return

        if event_type == "reach":
            self.pending_riichi.add(actor)
            return

        if event_type == "reach_accepted":
            self.riichi[actor] = True
            if actor in self.pending_riichi:
                self.pending_riichi.remove(actor)
            self.scores[actor] -= 1000
            self.kyotaku += 1
            return

        if event_type in {"chi", "pon", "daiminkan"}:
            target = normalize_actor(event.get("target"))
            if target is not None and self.discards[target]:
                self.discards[target][-1]["called"] = True
            consumed = normalize_tile_list(event.get("consumed"))
            remove_tiles(self.hands[actor], consumed)
            self.drawn_tiles[actor] = None
            self.melds[actor].append(
                {
                    "type": event_type,
                    "pai": tile,
                    "consumed": consumed,
                    "target": target,
                },
            )
            return

        if event_type == "ankan":
            consumed = normalize_tile_list(event.get("consumed")) or ([tile] * 4 if tile else [])
            remove_tiles(self.hands[actor], consumed)
            self.drawn_tiles[actor] = None
            self.melds[actor].append({"type": event_type, "pai": tile, "consumed": consumed, "target": actor})
            return

        if event_type == "kakan":
            consumed = normalize_tile_list(event.get("consumed")) or ([tile] if tile else [])
            remove_tiles(self.hands[actor], consumed)
            self.drawn_tiles[actor] = None
            self.melds[actor].append(
                {
                    "type": event_type,
                    "pai": tile,
                    "consumed": consumed,
                    "target": normalize_actor(event.get("target")) or actor,
                },
            )
            return

        if event_type in {"hora", "ryukyoku", "end_game"}:
            self.apply_score_update(event)

    def apply_score_update(self, event: dict[str, Any]) -> None:
        scores = event.get("scores")
        if isinstance(scores, list) and len(scores) >= 4:
            self.scores = [int(score) for score in scores[:4]]
            return

        deltas = event.get("deltas")
        if isinstance(deltas, list) and len(deltas) >= 4:
            self.scores = [score + int(delta) for score, delta in zip(self.scores, deltas[:4])]

    def snapshot(self, trigger_event: dict[str, Any]) -> dict[str, Any]:
        return {
            "trigger_event": trigger_event,
            "target_actor": self.target_actor,
            "table": {
                "target_actor": self.target_actor,
                "bakaze": self.bakaze,
                "kyoku": self.kyoku,
                "kyoku_index": kyoku_to_index(self.bakaze, self.kyoku),
                "honba": self.honba,
                "kyotaku": self.kyotaku,
                "oya": self.oya,
                "scores": list(self.scores),
                "dora_markers": list(self.dora_markers),
                "hands": [list(hand) for hand in self.hands],
                "drawn_tiles": list(self.drawn_tiles),
                "discards": [[dict(discard) for discard in discards] for discards in self.discards],
                "melds": [[dict(meld) for meld in melds] for melds in self.melds],
                "riichi": list(self.riichi),
                "pending_riichi": sorted(self.pending_riichi),
                "tiles_left": self.tiles_left,
                "last_actor": self.last_actor,
                "last_tile": self.last_tile,
            },
        }


def normalize_events_with_mjai_reviewer(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not settings.mjai_reviewer_manifest.exists():
        return events

    with tempfile.TemporaryDirectory(prefix="mjai_review_") as temp_dir:
        temp_path = Path(temp_dir)
        in_file = temp_path / "input.jsonl"
        out_file = temp_path / "normalized.jsonl"
        in_file.write_text(
            "".join(json.dumps(event, ensure_ascii=False) + "\n" for event in events),
            encoding="utf-8",
        )

        command = [
            settings.cargo_bin,
            "run",
            "--manifest-path",
            str(settings.mjai_reviewer_manifest),
            "--",
            "--no-review",
            "--in-file",
            str(in_file),
            "--mjai-out",
            str(out_file),
        ]
        try:
            process = subprocess.run(
                command,
                cwd=settings.repo_root,
                capture_output=True,
                timeout=180,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return events
        if process.returncode != 0 or not out_file.exists():
            return events
        return load_events_from_file(out_file)


def run_fallback_review(events: list[dict[str, Any]], target_actor: int, reason: str) -> ReviewRunResult:
    entries: list[ReviewEntryDraft] = []
    table_state = ReviewTableState(target_actor)
    kyoku_index = -1
    honba = 0
    junme = 0
    tiles_left = 70
    last_actor: int | None = None
    last_tile: str | None = None

    for event in events:
        event_type = event.get("type")
        table_state.apply(event)
        if event_type == "start_kyoku":
            kyoku_index += 1
            honba = int(event.get("honba", 0))
            junme = 0
            tiles_left = 70
            continue

        actor = event.get("actor")
        if actor is not None:
            last_actor = int(actor)
        if isinstance(event.get("pai"), str):
            last_tile = event.get("pai")

        if event_type == "tsumo" and actor == target_actor:
            junme += 1
            tiles_left = max(0, tiles_left - 1)

        if event_type not in ACTIONABLE_TYPES or actor != target_actor:
            continue

        expected_action = {key: value for key, value in event.items() if key != "meta"}
        decision_type = DECISION_TYPE_MAP.get(str(event_type), "other")
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
                actual_action=event,
                expected_action=expected_action,
                is_match=True,
                deviation_level="none",
                delta_score=0.0,
                shanten=None,
                at_furiten=None,
                details=[
                    {
                        "expected_action": expected_action,
                        "prob": 1.0,
                        "engine_meta": {"mode": "fallback"},
                    },
                ],
                state_snapshot=table_state.snapshot(event),
                tags=["fallback"],
            ),
        )

    reviewed_decision_count = len(entries)
    summary = {
        "target_actor": target_actor,
        "reviewed_decision_count": reviewed_decision_count,
        "match_decision_count": reviewed_decision_count,
        "optimal_count": reviewed_decision_count,
        "mistake_count": 0,
        "big_mistake_count": 0,
        "medium_deviation_count": 0,
        "high_deviation_count": 0,
        "riichi_mistake_count": 0,
        "call_mistake_count": 0,
        "defense_mistake_count": 0,
        "rating": 1.0,
        "fallback_reason": reason,
    }
    stats = {
        "rating": 1.0,
        "phi_matrix": [],
        "decision_type_breakdown": {
            "discard": sum(1 for entry in entries if entry.decision_type == "discard"),
            "riichi": sum(1 for entry in entries if entry.decision_type == "riichi"),
            "chi": sum(1 for entry in entries if entry.decision_type == "chi"),
            "pon": sum(1 for entry in entries if entry.decision_type == "pon"),
            "kan": sum(1 for entry in entries if entry.decision_type == "kan"),
            "agari": sum(1 for entry in entries if entry.decision_type == "agari"),
            "ryukyoku": sum(1 for entry in entries if entry.decision_type == "ryukyoku"),
            "other": sum(1 for entry in entries if entry.decision_type == "other"),
        },
        "mistake_category_breakdown": {
            "riichi_judgment": 0,
            "call_judgment": 0,
            "defense": 0,
            "efficiency": 0,
            "attack": 0,
        },
        "fallback_reason": reason,
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
        "engine": {"name": "mjai-reviewer-lite", "version": "engine-free", "model_tag": None},
    }

    return ReviewRunResult(
        target_actor=target_actor,
        engine_name="mjai-reviewer-lite",
        engine_version="engine-free",
        model_tag=None,
        rating=1.0,
        summary=summary,
        stats=stats,
        entries=entries,
        raw_result=raw_result,
    )


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
        errors="replace",
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
    decision_event = events[start_index]
    decision_type = decision_event.get("type")
    decision_actor = decision_event.get("actor")
    is_reaction_window = decision_type in {"dahai", "kakan"} and decision_actor != target_actor

    for event in events[start_index + 1 :]:
        event_type = event.get("type")
        if event_type in BOUNDARY_TYPES:
            return None
        if event_type in ACTIONABLE_TYPES and event.get("actor") == target_actor:
            return event
        if is_reaction_window and event_type in {"tsumo", "dahai", "reach", "dora"}:
            return None
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


def classify_entry_tags(decision_type: str, shanten: int | None, defense_context: bool) -> list[str]:
    tags: list[str] = []
    if decision_type == "riichi":
        tags.append("riichi_judgment")
    elif decision_type in {"chi", "pon", "kan"}:
        tags.extend(["call_judgment", f"{decision_type}_judgment"])
    elif decision_type == "discard":
        if defense_context:
            tags.append("defense")
        elif shanten is not None and shanten <= 1:
            tags.append("attack")
        else:
            tags.append("efficiency")
    elif decision_type == "agari":
        tags.append("agari_judgment")
    elif decision_type == "ryukyoku":
        tags.append("ryukyoku_judgment")

    return tags or ["other"]


def classify_deviation_level(
    is_match: bool,
    decision_type: str,
    expected_action: dict[str, Any],
    actual_action: dict[str, Any] | None,
    tags: list[str],
    q_spread: float,
) -> str:
    if is_match:
        return "none"

    actual_type = actual_action.get("type") if actual_action else "none"
    expected_type = expected_action.get("type")
    if "defense" in tags:
        return "high"
    if decision_type in {"riichi", "chi", "pon", "kan", "agari", "ryukyoku"}:
        return "high"
    if actual_type != expected_type:
        return "high"
    if q_spread >= 8.0:
        return "high"
    return "medium"


def build_review(
    events: list[dict[str, Any]],
    outputs: list[dict[str, Any]],
    extra_data: dict[str, Any],
    target_actor: int,
) -> ReviewRunResult:
    entries: list[ReviewEntryDraft] = []
    table_state = ReviewTableState(target_actor)
    kyoku_index = -1
    honba = 0
    junme = 0
    tiles_left = 70
    last_actor: int | None = None
    last_tile: str | None = None
    riichi_actors: set[int] = set()

    for index, event in enumerate(events):
        event_type = event.get("type")
        table_state.apply(event)
        if event_type == "start_kyoku":
            kyoku_index += 1
            honba = int(event.get("honba", 0))
            junme = 0
            tiles_left = 70
            last_actor = None
            last_tile = None
            riichi_actors = set()
            continue
        actor = event.get("actor")
        if event_type == "reach" and actor is not None:
            riichi_actors.add(int(actor))
        if event_type in {"end_kyoku", "end_game", "start_game"}:
            continue

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
        if expected_action.get("type") == "none" and actual_action is None:
            continue
        is_match = action_matches(expected_action, actual_action)
        decision_type = DECISION_TYPE_MAP.get(expected_action.get("type"), "other")
        q_values = meta.get("q_values", []) or []
        best_q_value = float(max(q_values)) if q_values else None
        q_spread = float(max(q_values) - min(q_values)) if len(q_values) >= 2 else 0.0
        shanten = meta.get("shanten")
        defense_context = any(other_actor != target_actor for other_actor in riichi_actors)
        tags = classify_entry_tags(decision_type, shanten, defense_context)
        deviation_level = classify_deviation_level(
            is_match=is_match,
            decision_type=decision_type,
            expected_action=expected_action,
            actual_action=actual_action,
            tags=tags,
            q_spread=q_spread,
        )

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
                delta_score=None if is_match else round(q_spread, 4),
                shanten=shanten,
                at_furiten=meta.get("at_furiten"),
                details=[
                    {
                        "expected_action": expected_action,
                        "best_q_value": best_q_value,
                        "prob": 1.0,
                        "engine_meta": meta,
                    }
                ],
                state_snapshot=table_state.snapshot(event),
                tags=tags,
            ),
        )

    reviewed_decision_count = len(entries)
    optimal_count = sum(1 for entry in entries if entry.is_match)
    mistake_count = reviewed_decision_count - optimal_count
    medium_deviation_count = sum(1 for entry in entries if entry.deviation_level == "medium")
    high_deviation_count = sum(1 for entry in entries if entry.deviation_level == "high")
    riichi_mistake_count = sum(
        1 for entry in entries if not entry.is_match and "riichi_judgment" in entry.tags
    )
    call_mistake_count = sum(1 for entry in entries if not entry.is_match and "call_judgment" in entry.tags)
    defense_mistake_count = sum(1 for entry in entries if not entry.is_match and "defense" in entry.tags)
    rating = optimal_count / reviewed_decision_count if reviewed_decision_count else 0.0

    summary = {
        "target_actor": target_actor,
        "reviewed_decision_count": reviewed_decision_count,
        "match_decision_count": optimal_count,
        "optimal_count": optimal_count,
        "mistake_count": mistake_count,
        "big_mistake_count": high_deviation_count,
        "medium_deviation_count": medium_deviation_count,
        "high_deviation_count": high_deviation_count,
        "riichi_mistake_count": riichi_mistake_count,
        "call_mistake_count": call_mistake_count,
        "defense_mistake_count": defense_mistake_count,
        "rating": rating,
    }
    stats = {
        "rating": rating,
        "phi_matrix": extra_data.get("phi_matrix", []),
        "decision_type_breakdown": {
            "discard": sum(1 for entry in entries if entry.decision_type == "discard"),
            "riichi": sum(1 for entry in entries if entry.decision_type == "riichi"),
            "chi": sum(1 for entry in entries if entry.decision_type == "chi"),
            "pon": sum(1 for entry in entries if entry.decision_type == "pon"),
            "kan": sum(1 for entry in entries if entry.decision_type == "kan"),
            "agari": sum(1 for entry in entries if entry.decision_type == "agari"),
            "ryukyoku": sum(1 for entry in entries if entry.decision_type == "ryukyoku"),
            "other": sum(1 for entry in entries if entry.decision_type == "other"),
        },
        "mistake_category_breakdown": {
            "riichi_judgment": riichi_mistake_count,
            "call_judgment": call_mistake_count,
            "defense": defense_mistake_count,
            "efficiency": sum(1 for entry in entries if not entry.is_match and "efficiency" in entry.tags),
            "attack": sum(1 for entry in entries if not entry.is_match and "attack" in entry.tags),
        },
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
    raw_events = load_events_for_job(db, job)
    events = normalize_events_with_mjai_reviewer(raw_events)
    target_actor = determine_target_actor(job)
    job.target_actor = target_actor
    outputs, extra_data = run_mortal_review(events, target_actor)
    return build_review(events, outputs, extra_data, target_actor)
