from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Match, MatchEvent, User, utcnow
from .review_engine import ReviewTableState, action_matches

TRAINABLE_ACTION_TYPES = {"dahai"}


class ClassicTrainingError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClassicGame:
    id: str
    title: str
    subtitle: str
    source: str
    year: int
    match_type: str
    target_actor: int
    players: tuple[str, str, str, str]
    tags: tuple[str, ...]
    summary: str
    events: tuple[dict[str, Any], ...]


def _start_kyoku(
    *,
    bakaze: str,
    kyoku: int,
    oya: int,
    scores: list[int],
    dora_marker: str,
    target_hand: list[str],
) -> dict[str, Any]:
    hands = [["?"] * 13 for _ in range(4)]
    hands[0] = target_hand
    return {
        "type": "start_kyoku",
        "bakaze": bakaze,
        "kyoku": kyoku,
        "honba": 0,
        "kyotaku": 0,
        "oya": oya,
        "scores": scores,
        "dora_marker": dora_marker,
        "tehais": hands,
    }


CLASSIC_GAMES: tuple[ClassicGame, ...] = (
    ClassicGame(
        id="selected-efficiency-01",
        title="经典牌效：好形保留与安全牌时机",
        subtitle="从东一局的速度选择，打到东二局的攻守转换",
        source="MahjongLab 精选牌谱",
        year=2026,
        match_type="tonpu",
        target_actor=0,
        players=("原谱主视角", "南家", "西家", "北家"),
        tags=("牌效", "攻守转换", "两小局"),
        summary="前半段考察好形与孤张处理，后半段在对手进攻信号出现后重新评估安全度。",
        events=(
            {"type": "start_game"},
            _start_kyoku(
                bakaze="E",
                kyoku=1,
                oya=0,
                scores=[25000, 25000, 25000, 25000],
                dora_marker="4p",
                target_hand=["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "E"],
            ),
            {"type": "tsumo", "actor": 0, "pai": "9s"},
            {"type": "dahai", "actor": 0, "pai": "E", "tsumogiri": False},
            {"type": "tsumo", "actor": 1, "pai": "?"},
            {"type": "dahai", "actor": 1, "pai": "N", "tsumogiri": False},
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "9m", "tsumogiri": False},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "P", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "5s"},
            {"type": "dahai", "actor": 0, "pai": "9s", "tsumogiri": False},
            {"type": "hora", "actor": 0, "target": 1, "pai": "5s", "deltas": [3900, -3900, 0, 0]},
            {"type": "end_kyoku"},
            _start_kyoku(
                bakaze="E",
                kyoku=2,
                oya=1,
                scores=[28900, 21100, 25000, 25000],
                dora_marker="7s",
                target_hand=["1m", "3m", "4m", "5m", "6m", "7m", "2p", "3p", "4p", "6s", "7s", "8s", "C"],
            ),
            {"type": "tsumo", "actor": 1, "pai": "?"},
            {"type": "dahai", "actor": 1, "pai": "E", "tsumogiri": False},
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "1p", "tsumogiri": False},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "9p", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "6p"},
            {"type": "dahai", "actor": 0, "pai": "1m", "tsumogiri": False},
            {"type": "reach", "actor": 1},
            {"type": "reach_accepted", "actor": 1},
            {"type": "tsumo", "actor": 1, "pai": "?"},
            {"type": "dahai", "actor": 1, "pai": "5p", "tsumogiri": True},
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "F", "tsumogiri": False},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "2m", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "C"},
            {"type": "dahai", "actor": 0, "pai": "C", "tsumogiri": True},
            {"type": "ryukyoku", "deltas": [0, 1000, -500, -500]},
            {"type": "end_kyoku"},
            {"type": "end_game", "scores": [28900, 21100, 24500, 24500]},
        ),
    ),
    ClassicGame(
        id="selected-defense-01",
        title="经典攻守：先制压力下的两次取舍",
        subtitle="从东三局开始，观察速度、打点与现物价值如何变化",
        source="MahjongLab 精选牌谱",
        year=2026,
        match_type="hanchan",
        target_actor=0,
        players=("原谱主视角", "南家", "西家", "北家"),
        tags=("防守", "立直应对", "两小局"),
        summary="第一小局仍可争取先手，下一小局则更强调对手公开信息与手牌价值的权衡。",
        events=(
            {"type": "start_game"},
            _start_kyoku(
                bakaze="E",
                kyoku=3,
                oya=2,
                scores=[23800, 27100, 30200, 18900],
                dora_marker="3m",
                target_hand=["2m", "3m", "4m", "6m", "7m", "8m", "3p", "4p", "5p", "4s", "5s", "7s", "P"],
            ),
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "N", "tsumogiri": False},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "1s", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "6s"},
            {"type": "dahai", "actor": 0, "pai": "P", "tsumogiri": False},
            {"type": "reach", "actor": 2},
            {"type": "reach_accepted", "actor": 2},
            {"type": "tsumo", "actor": 1, "pai": "?"},
            {"type": "dahai", "actor": 1, "pai": "9s", "tsumogiri": False},
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "2p", "tsumogiri": True},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "8s", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "9p"},
            {"type": "dahai", "actor": 0, "pai": "9p", "tsumogiri": True},
            {"type": "hora", "actor": 2, "target": 3, "pai": "8s", "deltas": [0, 0, 5200, -5200]},
            {"type": "end_kyoku"},
            _start_kyoku(
                bakaze="E",
                kyoku=4,
                oya=3,
                scores=[23800, 26100, 35400, 14700],
                dora_marker="6p",
                target_hand=["1m", "2m", "4m", "5m", "7m", "8m", "2p", "4p", "7p", "2s", "5s", "8s", "E"],
            ),
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "C", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "3m"},
            {"type": "dahai", "actor": 0, "pai": "E", "tsumogiri": False},
            {"type": "reach", "actor": 1},
            {"type": "reach_accepted", "actor": 1},
            {"type": "tsumo", "actor": 1, "pai": "?"},
            {"type": "dahai", "actor": 1, "pai": "7p", "tsumogiri": True},
            {"type": "tsumo", "actor": 2, "pai": "?"},
            {"type": "dahai", "actor": 2, "pai": "W", "tsumogiri": False},
            {"type": "tsumo", "actor": 3, "pai": "?"},
            {"type": "dahai", "actor": 3, "pai": "1p", "tsumogiri": False},
            {"type": "tsumo", "actor": 0, "pai": "W"},
            {"type": "dahai", "actor": 0, "pai": "W", "tsumogiri": True},
            {"type": "ryukyoku", "deltas": [-1000, 3000, -1000, -1000]},
            {"type": "end_kyoku"},
            {"type": "end_game", "scores": [22800, 29100, 34400, 13700]},
        ),
    ),
)


def get_classic_game(game_id: str) -> ClassicGame | None:
    return next((game for game in CLASSIC_GAMES if game.id == game_id), None)


def _round_label(event: dict[str, Any]) -> str:
    wind = {"E": "东", "S": "南", "W": "西", "N": "北"}.get(str(event.get("bakaze")), "东")
    return f"{wind}{int(event.get('kyoku', 1))}局"


def _start_indexes(game: ClassicGame) -> list[int]:
    return [index for index, event in enumerate(game.events) if event.get("type") == "start_kyoku"]


def _decision_indexes(game: ClassicGame) -> list[int]:
    return [
        index
        for index, event in enumerate(game.events)
        if event.get("type") in TRAINABLE_ACTION_TYPES and event.get("actor") == game.target_actor
    ]


def serialize_classic_game(game: ClassicGame, *, include_hands: bool = True) -> dict[str, Any]:
    decisions = _decision_indexes(game)
    starts = _start_indexes(game)
    hands: list[dict[str, Any]] = []
    if include_hands:
        for hand_index, event_index in enumerate(starts):
            next_start = starts[hand_index + 1] if hand_index + 1 < len(starts) else len(game.events)
            hands.append(
                {
                    "index": hand_index,
                    "label": _round_label(game.events[event_index]),
                    "scores": list(game.events[event_index].get("scores", [])),
                    "decision_count": sum(event_index < decision_index < next_start for decision_index in decisions),
                },
            )
    return {
        "id": game.id,
        "title": game.title,
        "subtitle": game.subtitle,
        "source": game.source,
        "year": game.year,
        "match_type": game.match_type,
        "players": list(game.players),
        "tags": list(game.tags),
        "summary": game.summary,
        "hand_count": len(starts),
        "decision_count": len(decisions),
        "hands": hands,
    }


def _next_seq(db: Session, match_id: str) -> int:
    value = db.scalar(select(func.max(MatchEvent.seq)).where(MatchEvent.match_id == match_id))
    return int(value) + 1 if value is not None else 0


def _append_events(db: Session, match: Match, events: list[dict[str, Any]]) -> None:
    seq = _next_seq(db, match.id)
    for event in events:
        payload = deepcopy(event)
        db.add(
            MatchEvent(
                match_id=match.id,
                seq=seq,
                event_type=str(payload.get("type", "unknown")),
                payload_json=payload,
            ),
        )
        seq += 1


def _find_hand_index(game: ClassicGame, event_index: int) -> int:
    starts = _start_indexes(game)
    hand_index = 0
    for index, start_index in enumerate(starts):
        if start_index > event_index:
            break
        hand_index = index
    return hand_index


def _find_next_decision(game: ClassicGame, after_index: int) -> int | None:
    return next((index for index in _decision_indexes(game) if index > after_index), None)


def _session_events(db: Session, match_id: str) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MatchEvent).where(MatchEvent.match_id == match_id).order_by(MatchEvent.seq.asc()),
    ).all()
    return [deepcopy(row.payload_json) for row in rows]


def _clean_original_action(event: dict[str, Any]) -> dict[str, Any]:
    return {key: deepcopy(value) for key, value in event.items() if key != "meta"}


def _choice_history(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    for event in events:
        meta = event.get("meta")
        training = meta.get("classic_training") if isinstance(meta, dict) else None
        if not isinstance(training, dict):
            continue
        history.append(
            {
                "decision_index": int(training.get("decision_index", len(history))),
                "hand_index": int(training.get("hand_index", 0)),
                "hand_label": str(training.get("hand_label", "")),
                "turn": int(training.get("turn", 0)),
                "actual_action": deepcopy(training.get("actual_action") or {}),
                "original_action": deepcopy(training.get("original_action") or {}),
                "is_same": bool(training.get("is_same")),
            },
        )
    return history


def _current_snapshot(game: ClassicGame, events: list[dict[str, Any]]) -> tuple[dict[str, Any], int]:
    table = ReviewTableState(game.target_actor)
    turn = 0
    for event in events:
        table.apply(event)
        if event.get("type") == "start_kyoku":
            turn = 0
        elif event.get("type") == "tsumo" and event.get("actor") == game.target_actor:
            turn += 1
    trigger = events[-1] if events else {"type": "start_game"}
    return table.snapshot(trigger), turn


def _extract_result(game: ClassicGame, history: list[dict[str, Any]]) -> dict[str, Any]:
    end_game = next((event for event in reversed(game.events) if event.get("type") == "end_game"), {})
    return {
        "score": list(end_game.get("scores", [])),
        "classic_training": _build_comparison_summary(history),
    }


def _route_assessment(agreement_rate: float) -> tuple[str, str]:
    if agreement_rate >= 0.8:
        return "高度接近原谱", "大多数选择与原谱路线一致，整体取舍较为接近。"
    if agreement_rate >= 0.5:
        return "部分接近原谱", "部分关键选择相同，同时也形成了几处不同的取舍。"
    return "形成不同路线", "多数选择与原谱不同，体现了另一套牌效或攻守取舍。"


def _build_comparison_summary(history: list[dict[str, Any]]) -> dict[str, Any]:
    decision_count = len(history)
    same_count = sum(1 for item in history if item["is_same"])
    different_count = decision_count - same_count
    agreement_rate = same_count / decision_count if decision_count else 0.0
    route_label, route_description = _route_assessment(agreement_rate)

    hand_groups: dict[int, list[dict[str, Any]]] = {}
    for item in history:
        hand_groups.setdefault(int(item["hand_index"]), []).append(item)

    hands = []
    for hand_index, items in hand_groups.items():
        hand_same_count = sum(1 for item in items if item["is_same"])
        hands.append(
            {
                "hand_index": hand_index,
                "hand_label": str(items[0]["hand_label"]),
                "decision_count": len(items),
                "same_count": hand_same_count,
                "different_count": len(items) - hand_same_count,
                "agreement_rate": hand_same_count / len(items),
            },
        )

    return {
        "decision_count": decision_count,
        "same_count": same_count,
        "different_count": different_count,
        "agreement_rate": agreement_rate,
        "route_label": route_label,
        "route_description": route_description,
        "hands": hands,
    }


def _selected_decisions(game: ClassicGame, start_hand_index: int) -> list[int]:
    selected_start = _start_indexes(game)[start_hand_index]
    return [index for index in _decision_indexes(game) if index >= selected_start]


def _repair_legacy_cursor(db: Session, match: Match, game: ClassicGame) -> None:
    source = dict(match.source_json or {})
    cursor = source.get("classic_cursor")
    if match.status == "completed" or not isinstance(cursor, int):
        return
    if cursor in _decision_indexes(game):
        return

    next_decision = _find_next_decision(game, cursor)
    appended = list(game.events[cursor:next_decision]) if next_decision is not None else list(game.events[cursor:])
    if appended:
        _append_events(db, match, appended)

    source["classic_cursor"] = next_decision
    match.source_json = source
    match.updated_at = utcnow()
    if next_decision is None:
        match.status = "completed"
        match.result_json = _extract_result(game, _choice_history(_session_events(db, match.id) + appended))
    db.commit()
    db.refresh(match)


def create_classic_training_session(
    db: Session,
    *,
    user: User,
    game_id: str,
    start_hand_index: int,
    username: str,
) -> Match:
    game = get_classic_game(game_id)
    if game is None:
        raise ClassicTrainingError("经典牌谱不存在")

    starts = _start_indexes(game)
    if start_hand_index < 0 or start_hand_index >= len(starts):
        raise ClassicTrainingError("起始小局不存在")

    start_event_index = starts[start_hand_index]
    first_decision = next(
        (index for index in _decision_indexes(game) if index > start_event_index),
        None,
    )
    if first_decision is None:
        raise ClassicTrainingError("这个起点之后没有可训练的决策")

    match = Match(
        user_id=user.id,
        status="running",
        match_type=game.match_type,
        source_json={
            "origin": "classic_training",
            "classic_game_id": game.id,
            "classic_title": game.title,
            "username": username.strip() or "训练玩家",
            "target_actor": game.target_actor,
            "target_player_label": username.strip() or "训练玩家",
            "start_hand_index": start_hand_index,
            "classic_cursor": first_decision,
        },
    )
    db.add(match)
    db.commit()
    db.refresh(match)

    prefix: list[dict[str, Any]] = []
    if game.events and game.events[0].get("type") == "start_game":
        prefix.append(game.events[0])
    prefix.extend(game.events[start_event_index:first_decision])
    _append_events(db, match, prefix)
    db.commit()
    db.refresh(match)
    return match


def serialize_classic_training_session(db: Session, match: Match) -> dict[str, Any]:
    source = match.source_json or {}
    game_id = source.get("classic_game_id")
    game = get_classic_game(str(game_id)) if game_id else None
    if game is None or source.get("origin") != "classic_training":
        raise ClassicTrainingError("经典训练会话不存在")

    _repair_legacy_cursor(db, match, game)
    source = match.source_json or {}
    events = _session_events(db, match.id)
    choices = _choice_history(events)
    start_hand_index = int(source.get("start_hand_index", 0))
    selected_decisions = _selected_decisions(game, start_hand_index)
    cursor = source.get("classic_cursor")
    current_decision = None
    if match.status != "completed" and isinstance(cursor, int):
        original_action = game.events[cursor]
        snapshot, turn = _current_snapshot(game, events)
        hand_index = _find_hand_index(game, cursor)
        hand = snapshot.get("table", {}).get("hands", [[], [], [], []])[game.target_actor]
        options = list(dict.fromkeys(tile for tile in hand if isinstance(tile, str) and tile != "?"))
        current_position = selected_decisions.index(cursor)
        current_decision = {
            "decision_index": current_position,
            "total_decisions": len(selected_decisions),
            "hand_index": hand_index,
            "hand_label": _round_label(game.events[_start_indexes(game)[hand_index]]),
            "turn": turn,
            "action_type": original_action.get("type"),
            "state_snapshot": snapshot,
            "options": [{"type": "dahai", "pai": tile} for tile in options],
        }

    comparison_summary = _build_comparison_summary(choices) if match.status == "completed" else None
    return {
        "match_id": match.id,
        "status": match.status,
        "username": str(source.get("username") or "训练玩家"),
        "game": serialize_classic_game(game),
        "start_hand_index": start_hand_index,
        "answered_count": len(choices),
        "total_decisions": len(selected_decisions),
        "current_decision": current_decision,
        "history": choices if match.status == "completed" else [],
        "comparison_summary": comparison_summary,
        "result": match.result_json,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
    }


def submit_classic_training_action(
    db: Session,
    *,
    match: Match,
    action: dict[str, Any],
) -> Match:
    source = match.source_json or {}
    game = get_classic_game(str(source.get("classic_game_id", "")))
    cursor = source.get("classic_cursor")
    if game is None or source.get("origin") != "classic_training":
        raise ClassicTrainingError("经典训练会话不存在")
    _repair_legacy_cursor(db, match, game)
    source = match.source_json or {}
    cursor = source.get("classic_cursor")
    if match.status == "completed" or not isinstance(cursor, int):
        raise ClassicTrainingError("这次经典训练已经完成")

    original_action = game.events[cursor]
    if original_action.get("type") != "dahai":
        raise ClassicTrainingError("当前版本只支持打牌决策")
    if action.get("type") != "dahai" or not isinstance(action.get("pai"), str):
        raise ClassicTrainingError("请提交一个有效的打牌动作")

    events = _session_events(db, match.id)
    snapshot, turn = _current_snapshot(game, events)
    hand = snapshot.get("table", {}).get("hands", [[], [], [], []])[game.target_actor]
    chosen_tile = action["pai"]
    if chosen_tile not in hand:
        raise ClassicTrainingError("所选牌不在当前手牌中")

    drawn_tile = snapshot.get("table", {}).get("drawn_tiles", [None, None, None, None])[game.target_actor]
    actual_action = {
        "type": "dahai",
        "actor": game.target_actor,
        "pai": chosen_tile,
        "tsumogiri": chosen_tile == drawn_tile,
    }
    original_clean = _clean_original_action(original_action)
    hand_index = _find_hand_index(game, cursor)
    selected_decisions = _selected_decisions(game, int(source.get("start_hand_index", 0)))
    decision_index = selected_decisions.index(cursor)
    annotated_original = deepcopy(original_clean)
    annotated_original["meta"] = {
        "classic_training": {
            "actual_action": actual_action,
            "original_action": original_clean,
            "is_same": action_matches(original_clean, actual_action),
            "decision_index": decision_index,
            "hand_index": hand_index,
            "hand_label": _round_label(game.events[_start_indexes(game)[hand_index]]),
            "turn": turn,
        },
    }

    next_decision = _find_next_decision(game, cursor)
    appended = [annotated_original]
    if next_decision is None:
        appended.extend(game.events[cursor + 1 :])
    else:
        appended.extend(game.events[cursor + 1 : next_decision])
    _append_events(db, match, appended)

    updated_source = dict(source)
    updated_source["classic_cursor"] = next_decision
    match.source_json = updated_source
    match.updated_at = utcnow()
    if next_decision is None:
        match.status = "completed"
        history = _choice_history(events + appended)
        match.result_json = _extract_result(game, history)
    db.commit()
    db.refresh(match)
    return match
