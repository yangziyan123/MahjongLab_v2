from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from .schemas import ConversationAnswer, DecisionExplanation, EvidenceItem

NUMBER_PATTERN = re.compile(r"(?<![A-Za-z0-9])[-+]?\d+(?:\.\d+)?(?![A-Za-z0-9])")
FORBIDDEN_FUTURE_PATTERNS = (
    re.compile(r"后来"),
    re.compile(r"最终(?:摸|打|和|放铳)"),
    re.compile(r"之后摸到"),
    re.compile(r"对手(?:手里|手牌|持有)"),
)
MATCH_CONTRADICTION_PATTERNS = (
    re.compile(r"而不是"),
    re.compile(r"而非"),
    re.compile(r"实际动作.{0,12}(?:更差|不如|错误|有损)"),
    re.compile(r"(?:两个动作|实际动作与推荐动作).{0,12}(?:存在|(?<!没)有|形成).{0,6}(?:差距|优劣)"),
)


class ExplanationValidationError(ValueError):
    pass


def decision_is_match(decision_context: dict[str, Any]) -> bool:
    analysis = decision_context["engine_analysis"]
    return bool(analysis.get("is_match")) or (
        analysis.get("actual_action") == analysis.get("recommended_action")
    )


def _parse_json_model(
    text: str,
    model_type: type[ConversationAnswer] | type[DecisionExplanation],
    response_label: str,
):
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)
    try:
        payload = json.loads(candidate)
        return model_type.model_validate(payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ExplanationValidationError(f"模型未返回有效的{response_label}：{exc}") from exc


def parse_explanation_json(text: str) -> DecisionExplanation:
    return _parse_json_model(text, DecisionExplanation, "结构化解释")


def parse_conversation_answer_json(text: str) -> ConversationAnswer:
    return _parse_json_model(text, ConversationAnswer, "对话回答")


def _all_text(explanation: DecisionExplanation) -> list[str]:
    text = [
        explanation.verdict,
        explanation.teaching_rule,
        explanation.recommended_action,
        explanation.actual_action,
    ]
    text.extend(item.claim for item in explanation.key_points)
    text.extend(item.claim for item in explanation.uncertainties)
    for comparison in explanation.comparison:
        text.extend((comparison.actual_effect, comparison.recommended_effect))
    return text


def _numbers(value: Any) -> set[str]:
    return set(NUMBER_PATTERN.findall(json.dumps(value, ensure_ascii=False)))


def _validate_referenced_numbers(
    texts: list[str],
    evidence_ids: list[str],
    evidence_by_id: dict[str, EvidenceItem],
) -> None:
    claim_numbers = _numbers(texts)
    evidence_numbers = _numbers(
        [
            evidence_by_id[evidence_id].model_dump(mode="json")
            for evidence_id in evidence_ids
            if evidence_id in evidence_by_id
        ],
    )
    unsupported = sorted(claim_numbers - evidence_numbers)
    if unsupported:
        raise ExplanationValidationError(
            f"解释中的数值没有被本条引用证据支持：{', '.join(unsupported)}",
        )


def validate_explanation(
    explanation: DecisionExplanation,
    decision_context: dict[str, Any],
) -> DecisionExplanation:
    analysis = decision_context["engine_analysis"]
    if explanation.recommended_action != analysis["recommended_action_label"]:
        raise ExplanationValidationError("结构化解释中的推荐动作与复盘引擎不一致")
    if explanation.actual_action != analysis["actual_action_label"]:
        raise ExplanationValidationError("结构化解释中的实际动作与牌谱不一致")
    if decision_is_match(decision_context):
        if explanation.comparison:
            raise ExplanationValidationError("命中最优时不能比较相同的实际动作与推荐动作")
        matched_text = "\n".join(_all_text(explanation))
        if any(pattern.search(matched_text) for pattern in MATCH_CONTRADICTION_PATTERNS):
            raise ExplanationValidationError("命中最优时解释不能虚构动作差距或优劣")
        if not any(
            keyword in explanation.verdict
            for keyword in ("一致", "命中", "最优", "相同")
        ):
            raise ExplanationValidationError("命中最优时结论必须明确实际动作与推荐一致")

    ledger = [
        EvidenceItem.model_validate(item)
        for item in decision_context.get("evidence_ledger", [])
    ]
    evidence_by_id = {item.id: item for item in ledger}
    if len(evidence_by_id) != len(ledger):
        raise ExplanationValidationError("决策上下文包含重复证据 ID")

    supporting_ids: list[str] = []
    limitation_ids: list[str] = []
    for item in explanation.key_points:
        supporting_ids.extend(item.evidence_ids)
    for item in explanation.comparison:
        supporting_ids.extend(item.evidence_ids)
    for item in explanation.uncertainties:
        limitation_ids.extend(item.evidence_ids)

    referenced_ids = set(supporting_ids + limitation_ids)
    unknown_ids = sorted(referenced_ids - evidence_by_id.keys())
    if unknown_ids:
        raise ExplanationValidationError(f"解释引用了不存在的证据：{', '.join(unknown_ids)}")

    invalid_support = sorted(
        evidence_id
        for evidence_id in supporting_ids
        if evidence_by_id[evidence_id].kind == "limitation"
    )
    if invalid_support:
        raise ExplanationValidationError(
            f"限制项不能作为正向论据：{', '.join(invalid_support)}",
        )

    invalid_uncertainty = sorted(
        evidence_id
        for evidence_id in limitation_ids
        if evidence_by_id[evidence_id].kind != "limitation"
    )
    if invalid_uncertainty:
        raise ExplanationValidationError(
            f"不确定性必须引用限制证据：{', '.join(invalid_uncertainty)}",
        )

    context_limitations = {
        item.id for item in ledger if item.kind == "limitation"
    }
    if context_limitations and not context_limitations.intersection(limitation_ids):
        raise ExplanationValidationError("上下文存在数据限制，但解释没有披露任何限制")

    for item in explanation.key_points:
        _validate_referenced_numbers([item.claim], item.evidence_ids, evidence_by_id)
    for item in explanation.comparison:
        _validate_referenced_numbers(
            [item.actual_effect, item.recommended_effect],
            item.evidence_ids,
            evidence_by_id,
        )
    for item in explanation.uncertainties:
        _validate_referenced_numbers([item.claim], item.evidence_ids, evidence_by_id)
    if _numbers([explanation.verdict, explanation.teaching_rule]):
        raise ExplanationValidationError("结论和判断方法不得包含未逐条引用的数值")

    allowed_numbers = _numbers(decision_context)
    output_numbers = _numbers(_all_text(explanation))
    unsupported_numbers = sorted(output_numbers - allowed_numbers)
    if unsupported_numbers:
        raise ExplanationValidationError(
            f"解释包含没有证据支持的数值：{', '.join(unsupported_numbers)}",
        )

    joined_text = "\n".join(_all_text(explanation))
    if any(pattern.search(joined_text) for pattern in FORBIDDEN_FUTURE_PATTERNS):
        raise ExplanationValidationError("解释使用了未来事件或隐藏手牌信息")
    return explanation


def validate_conversation_answer(
    answer: ConversationAnswer,
    decision_context: dict[str, Any],
) -> ConversationAnswer:
    ledger = [
        EvidenceItem.model_validate(item)
        for item in decision_context.get("evidence_ledger", [])
    ]
    evidence_by_id = {item.id: item for item in ledger}
    referenced_ids = set(answer.evidence_ids + answer.uncertainty_ids)
    unknown_ids = sorted(referenced_ids - evidence_by_id.keys())
    if unknown_ids:
        raise ExplanationValidationError(f"回答引用了不存在的证据：{', '.join(unknown_ids)}")

    invalid_support = sorted(
        evidence_id
        for evidence_id in answer.evidence_ids
        if evidence_by_id[evidence_id].kind == "limitation"
    )
    if invalid_support:
        raise ExplanationValidationError(
            f"限制项不能作为正向论据：{', '.join(invalid_support)}",
        )

    invalid_uncertainty = sorted(
        evidence_id
        for evidence_id in answer.uncertainty_ids
        if evidence_by_id[evidence_id].kind != "limitation"
    )
    if invalid_uncertainty:
        raise ExplanationValidationError(
            f"不确定性必须引用限制证据：{', '.join(invalid_uncertainty)}",
        )

    if referenced_ids:
        _validate_referenced_numbers([answer.answer], list(referenced_ids), evidence_by_id)
    elif _numbers(answer.answer):
        raise ExplanationValidationError("未引用证据的对话回答不得包含数值")

    if any(pattern.search(answer.answer) for pattern in FORBIDDEN_FUTURE_PATTERNS):
        raise ExplanationValidationError("回答使用了未来事件或隐藏手牌信息")
    if decision_is_match(decision_context) and any(
        pattern.search(answer.answer) for pattern in MATCH_CONTRADICTION_PATTERNS
    ):
        raise ExplanationValidationError("命中最优时回答不能虚构动作差距或优劣")
    return answer


def render_explanation(explanation: DecisionExplanation, *, answer_mode: str) -> str:
    sections = [f"结论\n{explanation.verdict}"]
    evidence_lines = [
        f"{index}. {item.claim} [{', '.join(item.evidence_ids)}]"
        for index, item in enumerate(explanation.key_points, start=1)
    ]
    sections.append("关键依据\n" + "\n".join(evidence_lines))

    if explanation.comparison:
        comparisons = []
        for item in explanation.comparison:
            comparisons.append(
                f"- {item.dimension}: 实际动作会{item.actual_effect}；"
                f"推荐动作会{item.recommended_effect} [{', '.join(item.evidence_ids)}]",
            )
        sections.append("动作对比\n" + "\n".join(comparisons))

    if explanation.uncertainties:
        uncertainty_lines = [
            f"- {item.claim} [{', '.join(item.evidence_ids)}]"
            for item in explanation.uncertainties
        ]
        sections.append("数据限制\n" + "\n".join(uncertainty_lines))

    sections.append(f"判断方法\n{explanation.teaching_rule}")
    if answer_mode == "deep":
        sections.append(f"置信度\n{explanation.confidence}")
    return "\n\n".join(sections)
