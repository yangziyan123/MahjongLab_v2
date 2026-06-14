from __future__ import annotations

import asyncio
import json
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.config import Settings, load_service_env
from app.models import (
    Review,
    ReviewEntry,
    ReviewJob,
    ReviewMessage,
    ReviewMessageFeedback,
    User,
)
from app.review_assistant.context import DecisionContextCompiler
from app.review_assistant import routes as assistant_routes
from app.review_assistant.provider import OpenAICompatibleReviewAssistantProvider
from app.review_assistant.routes import (
    conversation_history,
    create_message,
    create_or_get_conversation,
    submit_feedback,
)
from app.schemas import ReviewAssistantFeedbackRequest, ReviewAssistantMessageRequest


def seed_review(db):
    user = User(display_name="Tester")
    db.add(user)
    db.commit()
    db.refresh(user)
    job = ReviewJob(
        user_id=user.id,
        status="completed",
        source_type="inline_json",
        source_payload={},
        options_json={},
        attempt_count=1,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    review = Review(
        job_id=job.id,
        user_id=user.id,
        target_actor=0,
        target_player_label="Tester",
        engine_name="mortal",
        engine_version="test",
        reviewed_decision_count=1,
        match_decision_count=0,
        high_deviation_count=0,
        medium_deviation_count=1,
        optimal_count=0,
        summary_json={},
        stats_json={},
        result_object_key="test.json",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    job.review_id = review.id
    entry = ReviewEntry(
        review_id=review.id,
        seq=0,
        kyoku_index=0,
        honba=0,
        junme=1,
        tiles_left=69,
        last_actor=0,
        tile="8m",
        decision_type="discard",
        actual_action_json={"type": "dahai", "actor": 0, "pai": "9s", "tsumogiri": False},
        expected_action_json={"type": "dahai", "actor": 0, "pai": "N", "tsumogiri": False},
        is_match=False,
        deviation_level="medium",
        delta_score=0,
        shanten=3,
        at_furiten=False,
        details_json=[
            {
                "expected_action": {"type": "dahai", "actor": 0, "pai": "N", "tsumogiri": False},
                "best_q_value": 0.13,
                "prob": 1.0,
            },
        ],
        state_snapshot_json={
            "table": {
                "target_actor": 0,
                "oya": 0,
                "scores": [25000, 25000, 25000, 25000],
                "dora_markers": ["4m"],
                "hands": [
                    ["F", "8p", "1m", "1m", "6p", "2m", "9s", "3m", "1s", "1s", "4m", "5s", "N", "8m"],
                    ["?"] * 13,
                    ["?"] * 13,
                    ["?"] * 13,
                ],
                "drawn_tiles": ["8m", None, None, None],
                "discards": [[], [], [], []],
                "melds": [[], [], [], []],
                "riichi": [False, False, False, False],
                "tiles_left": 69,
            },
        },
        tags_json=["efficiency"],
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return user, review, entry


async def collect_stream(response) -> str:
    chunks: list[str] = []
    async for chunk in response.body_iterator:
        chunks.append(chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk)
    return "".join(chunks)


class ReviewAssistantTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "assistant.db"
        self.engine = create_engine(f"sqlite:///{db_path.as_posix()}")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.original_session_local = assistant_routes.SessionLocal
        self.original_provider = assistant_routes.settings.review_assistant_provider
        assistant_routes.SessionLocal = self.Session
        assistant_routes.settings.review_assistant_provider = "deterministic"
        self.db = self.Session()
        self.user, self.review, self.entry = seed_review(self.db)

    def tearDown(self) -> None:
        self.db.close()
        assistant_routes.SessionLocal = self.original_session_local
        assistant_routes.settings.review_assistant_provider = self.original_provider
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_context_marks_missing_actual_action_score(self) -> None:
        compiled = DecisionContextCompiler().compile(self.review, self.entry)
        analysis = compiled.payload["engine_analysis"]

        self.assertIsNone(analysis["actual_action_score"])
        self.assertIsNone(analysis["score_gap"])
        self.assertEqual(analysis["recommended_action_score"], 0.13)
        self.assertIn("无法给出精确价值差", " ".join(compiled.payload["derived_facts"]["data_limitations"]))

    def test_conversation_is_reused_for_same_entry(self) -> None:
        first = create_or_get_conversation(self.review.id, self.entry.id, self.db)
        second = create_or_get_conversation(self.review.id, self.entry.id, self.db)

        self.assertEqual(first.id, second.id)
        self.assertEqual(first.entry_id, self.entry.id)
        self.assertEqual(first.provider_mode, "deterministic")
        self.assertTrue(first.suggested_questions)

    def test_message_stream_persists_completed_answer(self) -> None:
        conversation = create_or_get_conversation(self.review.id, self.entry.id, self.db)
        response = create_message(
            conversation.id,
            ReviewAssistantMessageRequest(
                content="为什么不是打 9s？",
                answer_mode="concise",
                client_request_id="request-1",
            ),
            self.db,
        )

        stream = asyncio.run(collect_stream(response))
        completed_lines = [line for line in stream.splitlines() if line.startswith("data: ")]
        completed_payload = json.loads(completed_lines[-1][6:])
        messages = self.db.scalars(
            select(ReviewMessage)
            .where(ReviewMessage.conversation_id == conversation.id)
            .order_by(ReviewMessage.created_at.asc()),
        ).all()

        self.assertIn("event: message.delta", stream)
        self.assertIn("event: message.completed", stream)
        self.assertEqual(completed_payload["message"]["status"], "completed")
        self.assertEqual([message.role for message in messages], ["user", "assistant"])
        self.assertIn("无法给出精确价值差", messages[1].content_json["text"])
        self.assertEqual(messages[1].model_provider, "deterministic")

    def test_feedback_is_upserted(self) -> None:
        conversation = create_or_get_conversation(self.review.id, self.entry.id, self.db)
        response = create_message(
            conversation.id,
            ReviewAssistantMessageRequest(
                content="解释这一手",
                answer_mode="concise",
                client_request_id="request-2",
            ),
            self.db,
        )
        asyncio.run(collect_stream(response))
        assistant = self.db.scalar(
            select(ReviewMessage).where(
                ReviewMessage.conversation_id == conversation.id,
                ReviewMessage.role == "assistant",
            ),
        )

        first = submit_feedback(
            assistant.id,
            ReviewAssistantFeedbackRequest(rating="helpful"),
            self.db,
        )
        second = submit_feedback(
            assistant.id,
            ReviewAssistantFeedbackRequest(rating="error", reason="与牌桌不符"),
            self.db,
        )
        feedback_count = len(self.db.scalars(select(ReviewMessageFeedback)).all())

        self.assertEqual(first.rating, "helpful")
        self.assertEqual(second.rating, "error")
        self.assertEqual(second.reason, "与牌桌不符")
        self.assertEqual(feedback_count, 1)

    def test_regeneration_history_excludes_previous_reply_to_same_question(self) -> None:
        conversation = create_or_get_conversation(self.review.id, self.entry.id, self.db)
        response = create_message(
            conversation.id,
            ReviewAssistantMessageRequest(
                content="解释这一手",
                answer_mode="concise",
                client_request_id="request-3",
            ),
            self.db,
        )
        asyncio.run(collect_stream(response))
        user_message = self.db.scalar(
            select(ReviewMessage).where(
                ReviewMessage.conversation_id == conversation.id,
                ReviewMessage.role == "user",
            ),
        )

        history = conversation_history(self.db, conversation.id, user_message.id)

        self.assertEqual(history, [])

    def test_deepseek_defaults_to_v4_flash_without_thinking(self) -> None:
        config = Settings()
        config.review_assistant_provider = "deepseek"
        config.review_assistant_base_url = ""
        config.review_assistant_model = ""
        config.review_assistant_api_key = "test-key"
        config.review_assistant_thinking = False
        captured: dict[str, object] = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def read(self) -> bytes:
                return json.dumps(
                    {
                        "choices": [{"message": {"content": "ok"}}],
                        "usage": {"prompt_tokens": 12, "completion_tokens": 3},
                    },
                ).encode("utf-8")

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["authorization"] = request.get_header("Authorization")
            captured["timeout"] = timeout
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            return FakeResponse()

        provider = OpenAICompatibleReviewAssistantProvider(config)
        with patch("urllib.request.urlopen", fake_urlopen):
            result = provider._request([{"role": "user", "content": "test"}])

        payload = captured["payload"]
        self.assertEqual(captured["url"], "https://api.deepseek.com/chat/completions")
        self.assertEqual(captured["authorization"], "Bearer test-key")
        self.assertEqual(payload["model"], "deepseek-v4-flash")
        self.assertEqual(payload["thinking"], {"type": "disabled"})
        self.assertEqual(payload["temperature"], 0.2)
        self.assertNotIn("reasoning_effort", payload)
        self.assertEqual(result.provider, "deepseek")
        self.assertEqual(result.model, "deepseek-v4-flash")

    def test_deepseek_thinking_uses_reasoning_effort_without_temperature(self) -> None:
        config = Settings()
        config.review_assistant_provider = "deepseek"
        config.review_assistant_model = "deepseek-v4-pro"
        config.review_assistant_api_key = "test-key"
        config.review_assistant_thinking = True
        captured: dict[str, object] = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def read(self) -> bytes:
                return b'{"choices":[{"message":{"content":"ok"}}]}'

        def fake_urlopen(request, timeout):
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            return FakeResponse()

        provider = OpenAICompatibleReviewAssistantProvider(config)
        with patch("urllib.request.urlopen", fake_urlopen):
            provider._request([{"role": "user", "content": "test"}])

        payload = captured["payload"]
        self.assertEqual(payload["model"], "deepseek-v4-pro")
        self.assertEqual(payload["thinking"], {"type": "enabled"})
        self.assertEqual(payload["reasoning_effort"], "high")
        self.assertNotIn("temperature", payload)

    def test_deepseek_stream_forwards_native_deltas_and_usage(self) -> None:
        config = Settings()
        config.review_assistant_provider = "deepseek"
        config.review_assistant_base_url = ""
        config.review_assistant_model = ""
        config.review_assistant_api_key = "test-key"
        config.review_assistant_thinking = False
        captured: dict[str, object] = {}

        class FakeResponse:
            status_code = 200
            reason_phrase = "OK"

            async def aread(self) -> bytes:
                return b""

            async def aiter_lines(self):
                lines = [
                    'data: {"choices":[{"delta":{"content":"这里"}}],"usage":null}',
                    'data: {"choices":[{"delta":{"content":"建议打 N"}}],"usage":null}',
                    'data: {"choices":[],"usage":{"prompt_tokens":21,"completion_tokens":8}}',
                    "data: [DONE]",
                ]
                for line in lines:
                    yield line

        class FakeStreamContext:
            async def __aenter__(self):
                return FakeResponse()

            async def __aexit__(self, exc_type, exc_value, traceback):
                return False

        class FakeAsyncClient:
            def __init__(self, *, timeout):
                captured["timeout"] = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc_value, traceback):
                return False

            def stream(self, method, url, *, json, headers):
                captured["method"] = method
                captured["url"] = url
                captured["payload"] = json
                captured["headers"] = headers
                return FakeStreamContext()

        async def collect_events():
            provider = OpenAICompatibleReviewAssistantProvider(config)
            return [
                event
                async for event in provider._stream_request(
                    [{"role": "user", "content": "test"}],
                )
            ]

        with patch("app.review_assistant.provider.httpx.AsyncClient", FakeAsyncClient):
            events = asyncio.run(collect_events())

        payload = captured["payload"]
        headers = captured["headers"]
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["url"], "https://api.deepseek.com/chat/completions")
        self.assertTrue(payload["stream"])
        self.assertEqual(payload["stream_options"], {"include_usage": True})
        self.assertEqual(headers["Accept"], "text/event-stream")
        self.assertEqual([event.delta for event in events[:-1]], ["这里", "建议打 N"])
        self.assertEqual(events[-1].result.text, "这里建议打 N")
        self.assertEqual(events[-1].result.input_tokens, 21)
        self.assertEqual(events[-1].result.output_tokens, 8)

    def test_service_env_is_loaded_without_overriding_process_environment(self) -> None:
        env_path = Path(self.temp_dir.name) / ".env"
        env_path.write_text(
            "\n".join(
                [
                    "MAHJONGLAB_REVIEW_ASSISTANT_PROVIDER=deepseek",
                    "MAHJONGLAB_REVIEW_ASSISTANT_API_KEY=from-file",
                    "MAHJONGLAB_REVIEW_ASSISTANT_THINKING=true",
                ],
            ),
            encoding="utf-8",
        )

        with patch.dict(
            os.environ,
            {"MAHJONGLAB_REVIEW_ASSISTANT_PROVIDER": "openai-compatible"},
            clear=True,
        ):
            load_service_env(env_path)
            config = Settings()

        self.assertEqual(config.review_assistant_provider, "openai-compatible")
        self.assertEqual(config.review_assistant_api_key, "from-file")
        self.assertTrue(config.review_assistant_thinking)


if __name__ == "__main__":
    unittest.main()
