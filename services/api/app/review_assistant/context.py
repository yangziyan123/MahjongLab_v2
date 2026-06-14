from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from ..models import Review, ReviewEntry

CONTEXT_VERSION = "decision-context.v1"


def normalized_action(action: dict[str, Any] | None) -> dict[str, Any]:
    if not action:
        return {}
    keys = ("type", "pai", "consumed", "target", "tsumogiri")
    return {key: action[key] for key in keys if key in action}


def actions_match(left: dict[str, Any] | None, right: dict[str, Any] | None) -> bool:
    return normalized_action(left) == normalized_action(right)


def action_label(action: dict[str, Any] | None) -> str:
    if not action:
        return "无动作"
    action_type = str(action.get("type", "unknown"))
    tile = action.get("pai")
    if action_type == "dahai":
        return f"打 {tile or '?'}"
    labels = {
        "reach": "立直",
        "chi": "吃",
        "pon": "碰",
        "daiminkan": "大明杠",
        "ankan": "暗杠",
        "kakan": "加杠",
        "hora": "和牌",
        "none": "跳过",
    }
    suffix = f" {tile}" if tile else ""
    return f"{labels.get(action_type, action_type)}{suffix}"


def round_label(kyoku_index: int) -> str:
    wind = ["东", "南", "西", "北"][max(0, kyoku_index) // 4 % 4]
    return f"{wind}{max(0, kyoku_index) % 4 + 1}局"


def suggested_questions(entry: ReviewEntry) -> list[str]:
    questions = ["为什么不是我的打法？", "两个动作差距大吗？", "给我一个判断口诀"]
    if entry.decision_type == "discard":
        questions.insert(1, "从牌效角度解释")
        questions.append("这里需要考虑防守吗？")
    elif entry.decision_type == "riichi":
        questions.insert(1, "立直和默听如何权衡？")
    elif entry.decision_type in {"chi", "pon", "kan"}:
        questions.insert(1, "鸣牌提升了什么？")
    return questions[:4]


@dataclass(slots=True)
class CompiledDecisionContext:
    payload: dict[str, Any]
    context_hash: str


class DecisionContextCompiler:
    def compile(self, review: Review, entry: ReviewEntry) -> CompiledDecisionContext:
        snapshot = entry.state_snapshot_json or {}
        table = snapshot.get("table") if isinstance(snapshot, dict) else {}
        table = table if isinstance(table, dict) else {}
        target_actor = table.get("target_actor", review.target_actor)
        hands = table.get("hands") if isinstance(table.get("hands"), list) else []
        drawn_tiles = table.get("drawn_tiles") if isinstance(table.get("drawn_tiles"), list) else []
        hand = hands[target_actor] if isinstance(target_actor, int) and target_actor < len(hands) else []
        drawn_tile = (
            drawn_tiles[target_actor]
            if isinstance(target_actor, int) and target_actor < len(drawn_tiles)
            else None
        )

        candidates: list[dict[str, Any]] = []
        actual_q_value: float | None = None
        recommended_q_value: float | None = None
        candidate_rank_of_actual: int | None = None
        for index, detail in enumerate(entry.details_json or []):
            if not isinstance(detail, dict):
                continue
            action = detail.get("expected_action")
            q_value = detail.get("best_q_value")
            candidate = {
                "rank": index + 1,
                "action": normalized_action(action if isinstance(action, dict) else None),
                "action_label": action_label(action if isinstance(action, dict) else None),
                "q_value": float(q_value) if isinstance(q_value, (int, float)) else None,
                "probability": detail.get("prob") if isinstance(detail.get("prob"), (int, float)) else None,
            }
            candidates.append(candidate)
            if actions_match(action, entry.actual_action_json):
                candidate_rank_of_actual = index + 1
                actual_q_value = candidate["q_value"]
            if actions_match(action, entry.expected_action_json):
                recommended_q_value = candidate["q_value"]

        q_gap = None
        if actual_q_value is not None and recommended_q_value is not None:
            q_gap = round(recommended_q_value - actual_q_value, 6)

        riichi = table.get("riichi") if isinstance(table.get("riichi"), list) else []
        public_riichi_count = sum(1 for actor, value in enumerate(riichi) if actor != target_actor and value)
        limitations: list[str] = []
        if actual_q_value is None and not entry.is_match:
            limitations.append("实际动作未出现在已保存的候选评分中，无法给出精确价值差")
        if len(candidates) <= 1:
            limitations.append("候选动作数据不完整，只能解释推荐方向")
        if not table:
            limitations.append("当前条目缺少完整牌桌快照")

        payload = {
            "schema_version": CONTEXT_VERSION,
            "review": {
                "review_id": review.id,
                "engine_name": review.engine_name,
                "engine_version": review.engine_version,
                "model_tag": review.model_tag,
            },
            "decision": {
                "entry_id": entry.id,
                "seq": entry.seq,
                "round": round_label(entry.kyoku_index),
                "honba": entry.honba,
                "turn": entry.junme,
                "decision_type": entry.decision_type,
                "tiles_left": entry.tiles_left,
                "tags": entry.tags_json or [],
            },
            "visible_state": {
                "target_seat": target_actor,
                "dealer_seat": table.get("oya"),
                "scores": table.get("scores", []),
                "dora_markers": table.get("dora_markers", []),
                "hand": hand,
                "drawn_tile": drawn_tile,
                "discards": table.get("discards", []),
                "melds": table.get("melds", []),
                "riichi": riichi,
                "tiles_left": table.get("tiles_left", entry.tiles_left),
            },
            "engine_analysis": {
                "actual_action": normalized_action(entry.actual_action_json),
                "actual_action_label": action_label(entry.actual_action_json),
                "recommended_action": normalized_action(entry.expected_action_json),
                "recommended_action_label": action_label(entry.expected_action_json),
                "deviation_level": entry.deviation_level,
                "shanten_before": entry.shanten,
                "at_furiten": entry.at_furiten,
                "actual_action_score": actual_q_value,
                "recommended_action_score": recommended_q_value,
                "score_gap": q_gap,
                "candidate_rank_of_actual": candidate_rank_of_actual,
                "candidates": candidates,
            },
            "derived_facts": {
                "public_riichi_count": public_riichi_count,
                "attack_pressure": "high" if public_riichi_count else "none",
                "data_limitations": limitations,
            },
        }
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        context_hash = f"sha256:{hashlib.sha256(canonical.encode('utf-8')).hexdigest()}"
        return CompiledDecisionContext(payload=payload, context_hash=context_hash)
