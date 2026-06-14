from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from typing import Any

from ..models import Review, ReviewEntry
from .tile_analysis import calculate_shanten

CONTEXT_VERSION = "decision-context.v2"

HONORS = {"E", "S", "W", "N", "P", "F", "C"}
WINDS = ["E", "S", "W", "N"]
TILE_TYPES = [
    *(f"{rank}m" for rank in range(1, 10)),
    *(f"{rank}p" for rank in range(1, 10)),
    *(f"{rank}s" for rank in range(1, 10)),
    "E",
    "S",
    "W",
    "N",
    "P",
    "F",
    "C",
]
TILE_INDEX = {tile: index for index, tile in enumerate(TILE_TYPES)}


def deaka_tile(tile: str) -> str:
    return f"5{tile[1]}" if len(tile) == 2 and tile[0] == "0" and tile[1] in "mps" else tile


def tile_category(tile: str) -> str:
    normalized = deaka_tile(tile)
    if normalized in HONORS:
        return "honor"
    if len(normalized) == 2 and normalized[0] in {"1", "9"} and normalized[1] in "mps":
        return "terminal"
    return "simple"


def dora_from_marker(marker: str) -> str | None:
    marker = deaka_tile(marker)
    if marker in WINDS:
        return WINDS[(WINDS.index(marker) + 1) % len(WINDS)]
    dragons = ["P", "F", "C"]
    if marker in dragons:
        return dragons[(dragons.index(marker) + 1) % len(dragons)]
    if len(marker) == 2 and marker[0].isdigit() and marker[1] in "mps":
        rank = int(marker[0])
        return f"{1 if rank == 9 else rank + 1}{marker[1]}"
    return None


def tile_feature(tile: str | None, hand: list[str], riichi_discards: dict[int, set[str]]) -> dict[str, Any]:
    if not tile:
        return {}
    normalized = deaka_tile(tile)
    normalized_hand = [deaka_tile(item) for item in hand if item and item != "?"]
    counts = Counter(normalized_hand)
    neighbors: list[str] = []
    if len(normalized) == 2 and normalized[0].isdigit() and normalized[1] in "mps":
        rank = int(normalized[0])
        suit = normalized[1]
        for offset in (-2, -1, 1, 2):
            neighbor_rank = rank + offset
            neighbor = f"{neighbor_rank}{suit}"
            if 1 <= neighbor_rank <= 9 and counts[neighbor]:
                neighbors.append(neighbor)
    isolated = counts[normalized] == 1 and not neighbors
    safe_against = [
        seat
        for seat, discards in riichi_discards.items()
        if normalized in discards
    ]
    return {
        "tile": tile,
        "normalized_tile": normalized,
        "category": tile_category(normalized),
        "count_in_hand": counts[normalized],
        "nearby_tiles": sorted(set(neighbors)),
        "isolated": isolated,
        "safe_against_riichi_seats": safe_against,
    }


def hand_features(
    hand: list[str],
    dora_markers: list[str],
    target_melds: list[Any],
    *,
    target_actor: int,
    dealer_seat: int | None,
    round_wind: str | None,
) -> dict[str, Any]:
    normalized_hand = [deaka_tile(tile) for tile in hand if tile and tile != "?"]
    meld_tile_list: list[str] = []
    value_honor_melds: list[str] = []
    red_meld_dora_count = 0
    for meld in target_melds:
        if not isinstance(meld, dict):
            continue
        meld_type = meld.get("type")
        raw_consumed = [
            str(tile)
            for tile in meld.get("consumed", [])
            if tile not in {None, "?"}
        ]
        red_meld_dora_count += sum(1 for tile in raw_consumed if tile in {"0m", "0p", "0s"})
        consumed = [deaka_tile(tile) for tile in raw_consumed]
        meld_tiles = list(consumed)
        called_tile = meld.get("pai")
        if meld_type in {"chi", "pon", "daiminkan"} and called_tile not in {None, "?"}:
            red_meld_dora_count += int(str(called_tile) in {"0m", "0p", "0s"})
            meld_tiles.append(deaka_tile(str(called_tile)))
        if meld_type == "ankan" and not meld_tiles and called_tile not in {None, "?"}:
            meld_tiles = [deaka_tile(str(called_tile))] * 4
        meld_tile_list.extend(meld_tiles)
        if meld_type in {"pon", "daiminkan", "ankan", "kakan"} and called_tile in HONORS:
            value_honor_melds.append(str(called_tile))

    all_visible_self_tiles = normalized_hand + meld_tile_list
    counts = Counter(normalized_hand)
    all_counts = Counter(all_visible_self_tiles)
    dora_tiles = [tile for marker in dora_markers if (tile := dora_from_marker(marker))]
    dora_count = sum(all_counts[tile] for tile in dora_tiles)
    red_dora_count = sum(1 for tile in hand if tile in {"0m", "0p", "0s"}) + red_meld_dora_count
    isolated_honors = sorted(
        tile for tile in HONORS if counts[tile] == 1
    )
    isolated_number_tiles = sorted(
        tile
        for tile in counts
        if tile not in HONORS and tile_feature(tile, normalized_hand, {})["isolated"]
    )
    seat_wind = None
    if dealer_seat is not None:
        seat_wind = WINDS[(target_actor - dealer_seat) % 4]
    value_honors = {"P", "F", "C"}
    if seat_wind:
        value_honors.add(seat_wind)
    if round_wind:
        value_honors.add(round_wind)
    value_honor_pairs = sorted(tile for tile in value_honors if counts[tile] >= 2)
    numbered_suits = {
        tile[1]
        for tile in all_visible_self_tiles
        if len(tile) == 2 and tile[1] in "mps"
    }
    all_simples = bool(all_visible_self_tiles) and all(
        tile_category(tile) == "simple" for tile in all_visible_self_tiles
    )
    return {
        "pairs": sorted(tile for tile, count in counts.items() if count == 2),
        "triplets_or_quads": sorted(tile for tile, count in counts.items() if count >= 3),
        "isolated_honors": isolated_honors,
        "isolated_number_tiles": isolated_number_tiles,
        "dora_tiles": dora_tiles,
        "visible_dora_count": dora_count + red_dora_count,
        "red_dora_count": red_dora_count,
        "seat_wind": seat_wind,
        "round_wind": round_wind,
        "meld_tiles": meld_tile_list,
        "visible_value_routes": {
            "tanyao_compatible": all_simples,
            "value_honor_pairs": value_honor_pairs,
            "value_honor_melds": sorted(
                {tile for tile in value_honor_melds if tile in value_honors},
            ),
            "single_suit_with_honors": len(numbered_suits) == 1,
            "numbered_suits": sorted(numbered_suits),
        },
    }


def evidence_item(
    evidence_id: str,
    kind: str,
    statement: str,
    **data: Any,
) -> dict[str, Any]:
    return {
        "id": evidence_id,
        "kind": kind,
        "statement": statement,
        "data": data,
    }


def tiles_34(tiles: list[str]) -> list[int]:
    counts = [0] * 34
    for tile in tiles:
        normalized = deaka_tile(tile)
        index = TILE_INDEX.get(normalized)
        if index is not None:
            counts[index] += 1
    return counts


def remove_tile_copy(tiles: list[str], tile: str | None) -> list[str] | None:
    if not tile:
        return None
    normalized = deaka_tile(tile)
    result = list(tiles)
    for index in range(len(result) - 1, -1, -1):
        if deaka_tile(result[index]) == normalized:
            result.pop(index)
            return result
    return None


def known_visible_tile_counts(
    hand: list[str],
    discards: list[Any],
    melds: list[Any],
    dora_markers: list[str],
) -> Counter[str]:
    visible = Counter(deaka_tile(tile) for tile in hand if tile and tile != "?")
    visible.update(deaka_tile(tile) for tile in dora_markers if tile and tile != "?")
    for actor_discards in discards:
        if not isinstance(actor_discards, list):
            continue
        visible.update(
            deaka_tile(str(discard["pai"]))
            for discard in actor_discards
            if isinstance(discard, dict) and discard.get("pai") not in {None, "?"}
        )
    for actor_melds in melds:
        if not isinstance(actor_melds, list):
            continue
        for meld in actor_melds:
            if not isinstance(meld, dict):
                continue
            visible.update(
                deaka_tile(str(tile))
                for tile in meld.get("consumed", [])
                if tile not in {None, "?"}
            )
    return visible


def discard_efficiency_profile(
    action: dict[str, Any] | None,
    hand: list[str],
    known_visible: Counter[str],
) -> dict[str, Any] | None:
    if not isinstance(action, dict) or action.get("type") != "dahai":
        return None
    discarded_tile = action.get("pai")
    post_discard_hand = remove_tile_copy(hand, discarded_tile if isinstance(discarded_tile, str) else None)
    if post_discard_hand is None:
        return None
    post_discard_counts = tiles_34(post_discard_hand)
    shanten_after = calculate_shanten(post_discard_counts)
    effective_tiles: list[dict[str, Any]] = []
    for tile in TILE_TYPES:
        index = TILE_INDEX[tile]
        if post_discard_counts[index] >= 4:
            continue
        after_draw = list(post_discard_counts)
        after_draw[index] += 1
        shanten_after_draw = calculate_shanten(after_draw)
        if shanten_after_draw < shanten_after:
            effective_tiles.append(
                {
                    "tile": tile,
                    "shanten_after_draw": shanten_after_draw,
                    "visible_remaining_upper_bound": max(0, 4 - known_visible[tile]),
                },
            )
    return {
        "discard": discarded_tile,
        "shanten_after_discard": shanten_after,
        "effective_tile_types": effective_tiles,
        "effective_type_count": len(effective_tiles),
        "visible_remaining_upper_bound": sum(
            item["visible_remaining_upper_bound"] for item in effective_tiles
        ),
    }


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
        discards = table.get("discards") if isinstance(table.get("discards"), list) else []
        riichi_discards: dict[int, set[str]] = {}
        for actor, is_riichi in enumerate(riichi):
            if actor == target_actor or not is_riichi:
                continue
            actor_discards = discards[actor] if actor < len(discards) and isinstance(discards[actor], list) else []
            riichi_discards[actor] = {
                deaka_tile(str(discard.get("pai")))
                for discard in actor_discards
                if isinstance(discard, dict) and discard.get("pai")
            }

        dealer_seat = table.get("oya") if isinstance(table.get("oya"), int) else None
        round_wind = table.get("bakaze") if table.get("bakaze") in WINDS else None
        melds = table.get("melds", []) if isinstance(table.get("melds"), list) else []
        target_melds = (
            melds[target_actor]
            if isinstance(target_actor, int)
            and 0 <= target_actor < len(melds)
            and isinstance(melds[target_actor], list)
            else []
        )
        hand_shape = hand_features(
            hand,
            table.get("dora_markers", []) if isinstance(table.get("dora_markers"), list) else [],
            target_melds,
            target_actor=target_actor if isinstance(target_actor, int) else review.target_actor,
            dealer_seat=dealer_seat,
            round_wind=round_wind,
        )
        actual_tile = entry.actual_action_json.get("pai") if isinstance(entry.actual_action_json, dict) else None
        recommended_tile = (
            entry.expected_action_json.get("pai")
            if isinstance(entry.expected_action_json, dict)
            else None
        )
        actual_tile_feature = tile_feature(actual_tile, hand, riichi_discards)
        recommended_tile_feature = tile_feature(recommended_tile, hand, riichi_discards)
        dora_markers = (
            table.get("dora_markers", [])
            if isinstance(table.get("dora_markers"), list)
            else []
        )
        known_visible = known_visible_tile_counts(hand, discards, melds, dora_markers)
        actual_efficiency = discard_efficiency_profile(
            entry.actual_action_json,
            hand,
            known_visible,
        )
        recommended_efficiency = discard_efficiency_profile(
            entry.expected_action_json,
            hand,
            known_visible,
        )

        scores = table.get("scores", []) if isinstance(table.get("scores"), list) else []
        placement = None
        if isinstance(target_actor, int) and target_actor < len(scores):
            target_score = scores[target_actor]
            sorted_scores = sorted(scores, reverse=True)
            placement = {
                "current_rank": sorted_scores.index(target_score) + 1,
                "target_score": target_score,
                "leader_score": sorted_scores[0],
                "gap_to_leader": sorted_scores[0] - target_score,
                "is_dealer": target_actor == dealer_seat,
            }

        limitations: list[str] = []
        if actual_q_value is None and not entry.is_match:
            limitations.append("实际动作未出现在已保存的候选评分中，无法给出精确价值差")
        if len(candidates) <= 1:
            limitations.append("候选动作数据不完整，只能解释推荐方向")
        if not table:
            limitations.append("当前条目缺少完整牌桌快照")
        if actual_efficiency is None or recommended_efficiency is None:
            limitations.append("当前动作类型或牌桌数据不足，无法比较两个动作的有效进张")
        else:
            limitations.append("有效进张剩余枚数只按公开可见牌计算上限，无法扣除对手隐藏手牌")
        limitations.append("有效进张只比较向听改善，不代表完整的进张后续价值")
        limitations.append("役种信息仅标记可见的候选路线，不代表最终可和役种")

        evidence_ledger = [
            evidence_item(
                "T1",
                "table",
                f"{round_label(entry.kyoku_index)}第{entry.junme}巡，剩余{entry.tiles_left}张牌。",
                round=round_label(entry.kyoku_index),
                turn=entry.junme,
                tiles_left=entry.tiles_left,
            ),
            evidence_item(
                "T2",
                "table",
                f"四家点数为 {scores}。",
                scores=scores,
                placement=placement,
            ),
            evidence_item(
                "T3",
                "table",
                f"当前可见手牌为 {hand}。",
                hand=hand,
                drawn_tile=drawn_tile,
            ),
            evidence_item(
                "T4",
                "table",
                f"宝牌指示牌为 {table.get('dora_markers', [])}。",
                dora_markers=table.get("dora_markers", []),
            ),
            evidence_item(
                "T5",
                "table",
                f"公开立直数为 {public_riichi_count}。",
                public_riichi_count=public_riichi_count,
                riichi=riichi,
                discards=discards,
                melds=table.get("melds", []),
            ),
            evidence_item(
                "E1",
                "engine",
                f"牌谱中的实际动作是{action_label(entry.actual_action_json)}。",
                action=normalized_action(entry.actual_action_json),
                action_label=action_label(entry.actual_action_json),
            ),
            evidence_item(
                "E2",
                "engine",
                f"复盘引擎推荐{action_label(entry.expected_action_json)}。",
                action=normalized_action(entry.expected_action_json),
                action_label=action_label(entry.expected_action_json),
            ),
            evidence_item(
                "E3",
                "engine",
                f"引擎记录的向听数为 {entry.shanten if entry.shanten is not None else '未知'}，偏差等级为 {entry.deviation_level}。",
                shanten=entry.shanten,
                deviation_level=entry.deviation_level,
                at_furiten=entry.at_furiten,
            ),
            evidence_item(
                "E4",
                "engine",
                f"已保存 {len(candidates)} 个候选动作。",
                candidates=candidates,
                actual_action_score=actual_q_value,
                recommended_action_score=recommended_q_value,
                score_gap=q_gap,
                candidate_rank_of_actual=candidate_rank_of_actual,
            ),
            evidence_item(
                "D1",
                "derived",
                "公开牌桌压力由立直状态和河牌确定。",
                public_riichi_count=public_riichi_count,
                attack_pressure="high" if public_riichi_count else "none",
            ),
            evidence_item(
                "D2",
                "derived",
                f"推荐动作涉及牌张的可验证形状特征为 {recommended_tile_feature}。",
                tile_feature=recommended_tile_feature,
            ),
            evidence_item(
                "D3",
                "derived",
                f"实际动作涉及牌张的可验证形状特征为 {actual_tile_feature}。",
                tile_feature=actual_tile_feature,
            ),
            evidence_item(
                "D4",
                "derived",
                "手牌形状、可见宝牌和候选役种路线已由确定性规则提取。",
                hand_shape=hand_shape,
            ),
            evidence_item(
                "D5",
                "derived",
                "当前顺位与点差由公开点数计算。",
                placement=placement,
            ),
            evidence_item(
                "D6",
                "derived",
                "实际动作与推荐动作的切牌后向听和有效进张已用同一确定性算法计算。",
                actual_efficiency=actual_efficiency,
                recommended_efficiency=recommended_efficiency,
            ),
        ]
        evidence_ledger.extend(
            evidence_item(f"L{index}", "limitation", limitation, limitation=limitation)
            for index, limitation in enumerate(limitations, start=1)
        )

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
                "discards": discards,
                "melds": table.get("melds", []),
                "riichi": riichi,
                "tiles_left": table.get("tiles_left", entry.tiles_left),
            },
            "engine_analysis": {
                "actual_action": normalized_action(entry.actual_action_json),
                "actual_action_label": action_label(entry.actual_action_json),
                "recommended_action": normalized_action(entry.expected_action_json),
                "recommended_action_label": action_label(entry.expected_action_json),
                "is_match": entry.is_match,
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
                "actual_tile_feature": actual_tile_feature,
                "recommended_tile_feature": recommended_tile_feature,
                "actual_efficiency": actual_efficiency,
                "recommended_efficiency": recommended_efficiency,
                "hand_shape": hand_shape,
                "placement": placement,
                "data_limitations": limitations,
            },
            "evidence_ledger": evidence_ledger,
        }
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        context_hash = f"sha256:{hashlib.sha256(canonical.encode('utf-8')).hexdigest()}"
        return CompiledDecisionContext(payload=payload, context_hash=context_hash)
