from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from ..config import Settings, settings
from .prompts import build_provider_messages, should_generate_explanation
from .schemas import ActionComparison, ConversationAnswer, DecisionExplanation, EvidenceClaim
from .validation import (
    parse_conversation_answer_json,
    parse_explanation_json,
    render_explanation,
    decision_is_match,
    validate_conversation_answer,
    validate_explanation,
)


class ReviewAssistantProviderError(RuntimeError):
    pass


class StreamingJsonStringField:
    def __init__(self, field_name: str) -> None:
        self._field_pattern = re.compile(rf'"{re.escape(field_name)}"\s*:\s*"')
        self._search_buffer = ""
        self._started = False
        self._finished = False
        self._escaped = False
        self._unicode_escape = ""

    def feed(self, chunk: str) -> str:
        if self._finished or not chunk:
            return ""
        if not self._started:
            self._search_buffer += chunk
            match = self._field_pattern.search(self._search_buffer)
            if match is None:
                self._search_buffer = self._search_buffer[-128:]
                return ""
            chunk = self._search_buffer[match.end() :]
            self._search_buffer = ""
            self._started = True

        output: list[str] = []
        for character in chunk:
            if self._unicode_escape:
                self._unicode_escape += character
                if len(self._unicode_escape) == 5:
                    try:
                        output.append(chr(int(self._unicode_escape[1:], 16)))
                    except ValueError:
                        output.append(f"\\{self._unicode_escape}")
                    self._unicode_escape = ""
                    self._escaped = False
                continue
            if self._escaped:
                if character == "u":
                    self._unicode_escape = "u"
                    continue
                output.append(
                    {
                        '"': '"',
                        "\\": "\\",
                        "/": "/",
                        "b": "\b",
                        "f": "\f",
                        "n": "\n",
                        "r": "\r",
                        "t": "\t",
                    }.get(character, character),
                )
                self._escaped = False
                continue
            if character == "\\":
                self._escaped = True
                continue
            if character == '"':
                self._finished = True
                break
            output.append(character)
        return "".join(output)


@dataclass(slots=True)
class ProviderResult:
    text: str
    provider: str
    model: str
    explanation: dict[str, Any] | None = None
    evidence_ids: list[str] | None = None
    fallback_reason: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass(slots=True)
class ProviderStreamEvent:
    delta: str | None = None
    result: ProviderResult | None = None


class ReviewAssistantProvider(Protocol):
    def stream(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        answer_mode: str,
    ) -> AsyncIterator[ProviderStreamEvent]:
        ...


def tile_feature_summary(feature: dict[str, Any]) -> str:
    tile = feature.get("tile", "该牌")
    category = {
        "honor": "字牌",
        "terminal": "幺九牌",
        "simple": "中张牌",
    }.get(feature.get("category"), "牌张")
    if feature.get("isolated"):
        return f"{tile} 是单张孤立牌"
    nearby_tiles = feature.get("nearby_tiles") or []
    if nearby_tiles:
        return f"{tile} 是{category}，与 {nearby_tiles} 存在邻接"
    return f"{tile} 是{category}"


def efficiency_summary(profile: dict[str, Any] | None) -> str:
    if not profile:
        return "缺少可计算的切牌后牌效数据"
    return (
        f"切牌后为 {profile['shanten_after_discard']} 向听，"
        f"有 {profile['effective_type_count']} 种有效进张，"
        f"按公开牌计算的剩余枚数上限为 {profile['visible_remaining_upper_bound']}"
    )


class DeterministicReviewAssistantProvider:
    async def _generate_conversation(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
    ) -> ProviderResult:
        del history
        analysis = decision_context["engine_analysis"]
        derived = decision_context["derived_facts"]
        actual = analysis["actual_action_label"]
        recommended = analysis["recommended_action_label"]
        matched = decision_is_match(decision_context)
        normalized = question.strip().lower().rstrip("。！!？?")
        ledger = decision_context.get("evidence_ledger", [])

        def limitation_ids(*needles: str) -> list[str]:
            return [
                str(item["id"])
                for item in ledger
                if isinstance(item, dict)
                and item.get("kind") == "limitation"
                and any(needle in str(item.get("statement", "")) for needle in needles)
            ]

        evidence_ids: list[str] = []
        uncertainty_ids: list[str] = []
        if normalized in {"你好", "您好", "嗨", "hi", "hello", "在吗"}:
            text = "你好。我可以直接回答这手牌的动作、牌效或攻守问题。"
        elif normalized in {"谢谢", "感谢", "多谢", "thanks", "thank you"}:
            text = "不客气。你可以继续追问这手牌里的具体判断。"
        elif "你是谁" in normalized or "你能做什么" in normalized:
            text = "我是 MahjongLab 的复盘助手，负责结合当前牌桌和复盘引擎结果回答你的问题。"
        elif "差距" in normalized or "差多少" in normalized:
            evidence_ids = ["E1", "E2", "E4"]
            if matched:
                text = f"这手没有动作差距：你的实际动作和引擎推荐都是{actual}，已经命中最优。"
            elif analysis.get("score_gap") is None:
                uncertainty_ids = limitation_ids("精确价值差", "候选动作数据不完整")
                text = (
                    f"目前不能量化{actual}和{recommended}的精确价值差，因为已保存候选评分里"
                    f"缺少实际动作；能确定的是复盘引擎推荐{recommended}。"
                )
            else:
                text = (
                    f"引擎保存的动作价值差是 {analysis['score_gap']}，"
                    f"推荐动作是{recommended}，实际动作是{actual}。"
                )
        elif "防守" in normalized or "危险" in normalized or "攻守" in normalized:
            evidence_ids = ["T5", "D1"]
            if derived["public_riichi_count"]:
                text = "需要考虑防守，因为牌桌上已经出现公开立直；具体选牌仍只能依据当前可见河牌判断。"
            else:
                text = "当前没有公开立直这一强防守信号，因此不必仅因对手压力就切换到全面防守。"
        elif "牌效" in normalized or "进张" in normalized:
            evidence_ids = ["D6"]
            recommended_efficiency = derived.get("recommended_efficiency")
            actual_efficiency = derived.get("actual_efficiency")
            if recommended_efficiency and actual_efficiency:
                uncertainty_ids = limitation_ids("公开可见牌计算上限", "后续价值")
                if matched:
                    text = (
                        f"你选择的{actual}就是引擎推荐动作。打出后有 "
                        f"{actual_efficiency['effective_type_count']} 种有效进张；"
                        "剩余枚数只是按公开牌计算的上限，也不代表进张后的完整价值。"
                    )
                else:
                    text = (
                        f"单看确定性牌效，{recommended}有 "
                        f"{recommended_efficiency['effective_type_count']} 种有效进张，"
                        f"{actual}有 {actual_efficiency['effective_type_count']} 种。"
                        "剩余枚数只是按公开牌计算的上限，也不代表进张后的完整价值。"
                    )
            else:
                uncertainty_ids = limitation_ids("无法比较两个动作的有效进张")
                text = "现有快照不足以可靠比较这两个动作的有效进张，不能补造牌效数字。"
        elif matched:
            evidence_ids = ["E1", "E2"]
            text = f"这手你的实际动作就是引擎推荐的{actual}，已经命中最优。"
        else:
            evidence_ids = ["E1", "E2"]
            text = (
                f"直接回答你的问题：这份复盘里，牌谱实际动作是{actual}，"
                f"引擎推荐{recommended}。当前本地解释只能继续核对牌效、动作差距和公开攻守信号。"
            )

        answer = ConversationAnswer(
            answer=text,
            evidence_ids=evidence_ids,
            uncertainty_ids=uncertainty_ids,
        )
        validate_conversation_answer(answer, decision_context)
        return ProviderResult(
            text=answer.answer,
            evidence_ids=answer.evidence_ids + answer.uncertainty_ids,
            provider="deterministic",
            model="mahjonglab-rules-v3",
        )

    async def _generate(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        answer_mode: str,
    ) -> ProviderResult:
        if not should_generate_explanation(history, question):
            return await self._generate_conversation(
                decision_context=decision_context,
                history=history,
                question=question,
            )
        analysis = decision_context["engine_analysis"]
        derived = decision_context["derived_facts"]
        actual = analysis["actual_action_label"]
        recommended = analysis["recommended_action_label"]
        matched = decision_is_match(decision_context)
        recommended_feature = derived.get("recommended_tile_feature") or {}
        actual_feature = derived.get("actual_tile_feature") or {}
        recommended_efficiency = derived.get("recommended_efficiency")
        actual_efficiency = derived.get("actual_efficiency")
        key_points = [
            EvidenceClaim(
                claim=(
                    f"牌谱实际动作和复盘引擎推荐均为{actual}。"
                    if matched
                    else f"复盘引擎明确推荐{recommended}。"
                ),
                evidence_ids=["E1", "E2"] if matched else ["E2"],
            ),
        ]
        if derived["public_riichi_count"]:
            key_points.append(
                EvidenceClaim(
                    claim="当前存在公开立直，攻守判断必须纳入已公开的危险信号。",
                    evidence_ids=["T5", "D1"],
                ),
            )
        else:
            key_points.append(
                EvidenceClaim(
                    claim="当前没有公开立直，牌桌上没有立即转入全面防守的强信号。",
                    evidence_ids=["T5", "D1"],
                ),
            )
        if recommended_efficiency and len(key_points) < 3:
            key_points.append(
                EvidenceClaim(
                    claim=f"推荐动作的确定性牌效结果是：{efficiency_summary(recommended_efficiency)}。",
                    evidence_ids=["D6"],
                ),
            )
        if recommended_feature and len(key_points) < 3:
            key_points.append(
                EvidenceClaim(
                    claim=f"推荐动作对应的牌张特征是：{tile_feature_summary(recommended_feature)}。",
                    evidence_ids=["D2"],
                ),
            )

        comparison = []
        if not matched and recommended_efficiency and actual_efficiency:
            comparison.append(
                ActionComparison(
                    dimension="efficiency",
                    actual_effect=efficiency_summary(actual_efficiency),
                    recommended_effect=efficiency_summary(recommended_efficiency),
                    evidence_ids=["D6"],
                ),
            )
        elif not matched and (recommended_feature or actual_feature):
            comparison.append(
                ActionComparison(
                    dimension="flexibility",
                    actual_effect=tile_feature_summary(actual_feature),
                    recommended_effect=tile_feature_summary(recommended_feature),
                    evidence_ids=["D2", "D3"],
                ),
            )
        if not matched and analysis.get("score_gap") is not None:
            comparison.append(
                ActionComparison(
                    dimension="value",
                    actual_effect="采用实际动作的已保存引擎评分",
                    recommended_effect="采用更高的已保存引擎评分",
                    evidence_ids=["E4"],
                ),
            )

        limitations = derived.get("data_limitations", [])
        uncertainties = [
            EvidenceClaim(claim=limitation, evidence_ids=[f"L{index}"])
            for index, limitation in enumerate(limitations[:4], start=1)
        ]
        if matched:
            teaching_rule = "先确认实际动作是否与引擎推荐一致；命中时解释这个选择为何成立，不要把同一个动作硬拆成优劣对比。"
        elif "简单" in question or "口诀" in question:
            teaching_rule = "先检查公开攻守信号，再比较两个动作对现有手牌结构的确定性影响。"
        else:
            teaching_rule = "先锁定引擎推荐，再用公开牌桌、牌张形状和候选评分逐项验证；缺失的数据明确留空。"
        explanation = DecisionExplanation(
            recommended_action=recommended,
            actual_action=actual,
            verdict=(
                f"你的实际动作{actual}与复盘引擎推荐一致，这一手命中最优。"
                if matched
                else f"在当前可见证据下，应优先{recommended}，而不是{actual}。"
            ),
            key_points=key_points[:3],
            comparison=comparison,
            uncertainties=uncertainties,
            teaching_rule=teaching_rule,
            confidence="low" if limitations else "medium",
        )
        validate_explanation(explanation, decision_context)
        return ProviderResult(
            text=render_explanation(explanation, answer_mode=answer_mode),
            explanation=explanation.model_dump(mode="json"),
            evidence_ids=[
                evidence_id
                for section in (explanation.key_points, explanation.comparison, explanation.uncertainties)
                for item in section
                for evidence_id in item.evidence_ids
            ],
            provider="deterministic",
            model="mahjonglab-rules-v3",
        )

    async def stream(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        answer_mode: str,
    ) -> AsyncIterator[ProviderStreamEvent]:
        result = await self._generate(
            decision_context=decision_context,
            history=history,
            question=question,
            answer_mode=answer_mode,
        )
        for index in range(0, len(result.text), 24):
            yield ProviderStreamEvent(delta=result.text[index : index + 24])
        yield ProviderStreamEvent(result=result)


class OpenAICompatibleReviewAssistantProvider:
    def __init__(self, config: Settings) -> None:
        self.config = config

    async def stream(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        answer_mode: str,
    ) -> AsyncIterator[ProviderStreamEvent]:
        messages = build_provider_messages(decision_context, history, question, answer_mode)
        explanation_request = should_generate_explanation(history, question)
        matched = decision_is_match(decision_context)
        visible_field = StreamingJsonStringField("verdict" if explanation_request else "answer")
        streamed_visible_text = False
        if explanation_request and matched:
            actual = decision_context["engine_analysis"]["actual_action_label"]
            yield ProviderStreamEvent(
                delta=f"结论\n你的实际动作{actual}与复盘引擎推荐一致，这一手命中最优。",
            )
            streamed_visible_text = True
        try:
            raw_result = None
            async for event in self._stream_request(messages):
                if event.delta and not (explanation_request and matched):
                    visible_delta = visible_field.feed(event.delta)
                    if visible_delta:
                        if explanation_request and not streamed_visible_text:
                            visible_delta = f"结论\n{visible_delta}"
                        streamed_visible_text = True
                        yield ProviderStreamEvent(delta=visible_delta)
                if event.result is not None:
                    raw_result = event.result
            if raw_result is None:
                raise ReviewAssistantProviderError("大模型服务未返回完成事件")
            if explanation_request:
                explanation = parse_explanation_json(raw_result.text)
                validate_explanation(explanation, decision_context)
                result = ProviderResult(
                    text=render_explanation(explanation, answer_mode=answer_mode),
                    explanation=explanation.model_dump(mode="json"),
                    evidence_ids=[
                        evidence_id
                        for section in (
                            explanation.key_points,
                            explanation.comparison,
                            explanation.uncertainties,
                        )
                        for item in section
                        for evidence_id in item.evidence_ids
                    ],
                    provider=raw_result.provider,
                    model=raw_result.model,
                    input_tokens=raw_result.input_tokens,
                    output_tokens=raw_result.output_tokens,
                )
            else:
                answer = parse_conversation_answer_json(raw_result.text)
                validate_conversation_answer(answer, decision_context)
                result = ProviderResult(
                    text=answer.answer,
                    evidence_ids=answer.evidence_ids + answer.uncertainty_ids,
                    provider=raw_result.provider,
                    model=raw_result.model,
                    input_tokens=raw_result.input_tokens,
                    output_tokens=raw_result.output_tokens,
                )
        except (ReviewAssistantProviderError, ValueError) as exc:
            result = await DeterministicReviewAssistantProvider()._generate(
                decision_context=decision_context,
                history=history,
                question=question,
                answer_mode=answer_mode,
            )
            result.provider = "deterministic-fallback"
            result.fallback_reason = str(exc)
        if not streamed_visible_text:
            for index in range(0, len(result.text), 48):
                yield ProviderStreamEvent(delta=result.text[index : index + 48])
        yield ProviderStreamEvent(
            result=result,
        )

    def _request_options(
        self,
        messages: list[dict[str, str]],
        *,
        stream: bool,
    ) -> tuple[str, dict[str, Any], dict[str, str], str, bool]:
        is_deepseek = self.config.review_assistant_provider == "deepseek"
        base_url = self.config.review_assistant_base_url or (
            "https://api.deepseek.com" if is_deepseek else ""
        )
        model = self.config.review_assistant_model or (
            "deepseek-v4-flash" if is_deepseek else ""
        )
        if not base_url or not model:
            raise ReviewAssistantProviderError("大模型服务尚未配置")
        url = base_url.rstrip("/")
        if not url.endswith("/chat/completions"):
            url = f"{url}/chat/completions"
        request_payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": self.config.review_assistant_max_output_tokens,
            "stream": stream,
        }
        if stream:
            request_payload["stream_options"] = {"include_usage": True}
        if is_deepseek:
            request_payload["thinking"] = {
                "type": "enabled" if self.config.review_assistant_thinking else "disabled",
            }
            if self.config.review_assistant_thinking:
                request_payload["reasoning_effort"] = "high"
            else:
                request_payload["temperature"] = 0.2
        else:
            request_payload["temperature"] = 0.2
        payload = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream" if stream else "application/json",
        }
        if self.config.review_assistant_api_key:
            headers["Authorization"] = f"Bearer {self.config.review_assistant_api_key}"
        return url, request_payload, headers, model, is_deepseek

    def _request(self, messages: list[dict[str, str]]) -> ProviderResult:
        url, request_payload, headers, model, is_deepseek = self._request_options(
            messages,
            stream=False,
        )
        payload = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.config.review_assistant_timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ReviewAssistantProviderError(f"大模型服务请求失败：{exc}") from exc
        try:
            text = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, AttributeError) as exc:
            raise ReviewAssistantProviderError("大模型服务返回了无法识别的响应") from exc
        usage = data.get("usage") if isinstance(data, dict) else {}
        return ProviderResult(
            text=text,
            provider="deepseek" if is_deepseek else "openai-compatible",
            model=model,
            input_tokens=usage.get("prompt_tokens") if isinstance(usage, dict) else None,
            output_tokens=usage.get("completion_tokens") if isinstance(usage, dict) else None,
        )

    async def _stream_request(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[ProviderStreamEvent]:
        url, request_payload, headers, model, is_deepseek = self._request_options(
            messages,
            stream=True,
        )
        text_parts: list[str] = []
        input_tokens: int | None = None
        output_tokens: int | None = None
        timeout = httpx.Timeout(self.config.review_assistant_timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    url,
                    json=request_payload,
                    headers=headers,
                ) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode("utf-8", errors="replace")
                        detail = body[:500].strip() or response.reason_phrase
                        raise ReviewAssistantProviderError(
                            f"大模型服务请求失败：HTTP {response.status_code} {detail}",
                        )
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data_text = line[5:].strip()
                        if not data_text or data_text == "[DONE]":
                            continue
                        try:
                            data = json.loads(data_text)
                        except json.JSONDecodeError as exc:
                            raise ReviewAssistantProviderError("大模型流式响应格式无效") from exc
                        usage = data.get("usage") if isinstance(data, dict) else None
                        if isinstance(usage, dict):
                            input_tokens = usage.get("prompt_tokens", input_tokens)
                            output_tokens = usage.get("completion_tokens", output_tokens)
                        choices = data.get("choices") if isinstance(data, dict) else None
                        if not isinstance(choices, list) or not choices:
                            continue
                        delta = choices[0].get("delta") if isinstance(choices[0], dict) else None
                        content = delta.get("content") if isinstance(delta, dict) else None
                        if isinstance(content, str) and content:
                            text_parts.append(content)
                            yield ProviderStreamEvent(delta=content)
        except ReviewAssistantProviderError:
            raise
        except (httpx.HTTPError, TimeoutError) as exc:
            raise ReviewAssistantProviderError(f"大模型服务请求失败：{exc}") from exc

        text = "".join(text_parts).strip()
        if not text:
            raise ReviewAssistantProviderError("大模型服务未返回可展示的回答")
        yield ProviderStreamEvent(
            result=ProviderResult(
                text=text,
                provider="deepseek" if is_deepseek else "openai-compatible",
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            ),
        )


def get_review_assistant_provider(config: Settings = settings) -> ReviewAssistantProvider:
    if config.review_assistant_provider in {"openai-compatible", "deepseek"}:
        return OpenAICompatibleReviewAssistantProvider(config)
    return DeterministicReviewAssistantProvider()
