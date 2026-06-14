from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from ..config import Settings, settings
from .prompts import build_provider_messages


class ReviewAssistantProviderError(RuntimeError):
    pass


@dataclass(slots=True)
class ProviderResult:
    text: str
    provider: str
    model: str
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


def tile_groups(hand: list[Any]) -> tuple[list[str], list[str]]:
    tiles = [str(tile) for tile in hand if tile and tile != "?"]
    honors = [tile for tile in tiles if tile in {"E", "S", "W", "N", "P", "F", "C"}]
    number_tiles = [tile for tile in tiles if tile not in honors]
    return honors, number_tiles


class DeterministicReviewAssistantProvider:
    async def _generate(
        self,
        *,
        decision_context: dict[str, Any],
        history: list[dict[str, str]],
        question: str,
        answer_mode: str,
    ) -> ProviderResult:
        analysis = decision_context["engine_analysis"]
        state = decision_context["visible_state"]
        derived = decision_context["derived_facts"]
        decision = decision_context["decision"]
        actual = analysis["actual_action_label"]
        recommended = analysis["recommended_action_label"]
        deviation_label = {
            "none": "命中最优",
            "low": "低偏差",
            "medium": "中偏差",
            "high": "高偏差",
        }.get(analysis["deviation_level"], analysis["deviation_level"])
        honors, _ = tile_groups(state.get("hand", []))
        facts = [
            f"[引擎] 本手实际选择是{actual}，复盘引擎推荐{recommended}，偏差等级为{deviation_label}。",
            f"[牌桌] 当前为{decision['round']}第{decision['turn']}巡，向听数为{analysis['shanten_before'] if analysis['shanten_before'] is not None else '未知'}。",
        ]
        if derived["public_riichi_count"]:
            facts.append(f"[牌桌] 已有 {derived['public_riichi_count']} 家公开立直，需要把防守放进判断。")
        else:
            facts.append("[牌桌] 当前没有其他玩家公开立直，公开信息中没有立即转守的强信号。")

        inference = ""
        recommended_action = analysis.get("recommended_action", {})
        recommended_tile = recommended_action.get("pai")
        if (
            recommended_action.get("type") == "dahai"
            and recommended_tile in honors
            and honors.count(recommended_tile) == 1
        ):
            inference = (
                f"[推导] {recommended_tile} 是手中的字牌。序盘且没有公开防守压力时，先处理孤立字牌通常能保留数牌的搭子与改良空间。"
            )
        elif analysis.get("score_gap") is not None:
            inference = f"[引擎] 已保存候选评分中，推荐动作比实际动作高 {analysis['score_gap']:.4f}。"
        else:
            inference = "[推导] 现有数据能确认推荐方向，但不足以证明两个动作的精确价值差。"

        limitations = derived.get("data_limitations", [])
        limitation_text = f"\n\n数据限制：{'；'.join(limitations)}。" if limitations else ""
        memory_rule = "\n\n判断方法：先看是否有必须防守的公开信号，再比较哪些切牌会破坏仍可发展的搭子。"
        if "简单" in question or "口诀" in question:
            text = f"结论：优先{recommended}。\n\n口诀：无明显危险时，先留数牌变化，再处理孤立字牌。{limitation_text}"
        else:
            text = f"结论：这里更支持{recommended}，而不是{actual}。\n\n" + "\n".join(facts[:3])
            text += f"\n{inference}{memory_rule}{limitation_text}"
            if answer_mode == "deep":
                text += "\n\n继续复盘时，可以逐项检查向听、有效进张、打点路线和公开危险信号。当前条目未提供的数据不应靠猜测补齐。"
        return ProviderResult(text=text, provider="deterministic", model="mahjonglab-rules-v1")

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
        async for event in self._stream_request(messages):
            yield event

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
