from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal, get_db
from ..models import (
    Review,
    ReviewConversation,
    ReviewEntry,
    ReviewMessage,
    ReviewMessageFeedback,
    User,
)
from ..schemas import (
    ReviewAssistantConversationOut,
    ReviewAssistantFeedbackOut,
    ReviewAssistantFeedbackRequest,
    ReviewAssistantMessageOut,
    ReviewAssistantMessageRequest,
)
from .context import CONTEXT_VERSION, DecisionContextCompiler, round_label, suggested_questions
from .prompts import PROMPT_VERSION
from .provider import ReviewAssistantProviderError, get_review_assistant_provider

router = APIRouter()
compiler = DecisionContextCompiler()


def current_user(db: Session) -> User:
    user = db.scalar(select(User).limit(1))
    if user is None:
        user = User(display_name="MahjongLab User")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def message_text(message: ReviewMessage) -> str:
    content = message.content_json or {}
    return str(content.get("text", "")) if isinstance(content, dict) else ""


def serialize_message(message: ReviewMessage) -> ReviewAssistantMessageOut:
    content_json = message.content_json if isinstance(message.content_json, dict) else {}
    return ReviewAssistantMessageOut(
        id=message.id,
        role=message.role,
        content=message_text(message),
        status=message.status,
        model_provider=message.model_provider,
        model_name=message.model_name,
        prompt_version=message.prompt_version,
        context_hash=message.context_hash,
        latency_ms=message.latency_ms,
        created_at=message.created_at,
        feedback=message.feedback.rating if message.feedback is not None else None,
        sources=content_json.get("sources"),
        explanation=content_json.get("explanation"),
    )


def provider_mode() -> str:
    return (
        "llm"
        if settings.review_assistant_provider in {"openai-compatible", "deepseek"}
        else "deterministic"
    )


def serialize_conversation(
    db: Session,
    conversation: ReviewConversation,
) -> ReviewAssistantConversationOut:
    entry = db.get(ReviewEntry, conversation.review_entry_id)
    messages = db.scalars(
        select(ReviewMessage)
        .where(ReviewMessage.conversation_id == conversation.id)
        .order_by(ReviewMessage.created_at.asc()),
    ).all()
    return ReviewAssistantConversationOut(
        id=conversation.id,
        review_id=conversation.review_id,
        entry_id=conversation.review_entry_id,
        context_version=conversation.context_version,
        context_hash=conversation.context_hash,
        title=conversation.title,
        provider_mode=provider_mode(),
        messages=[serialize_message(message) for message in messages],
        suggested_questions=suggested_questions(entry) if entry is not None else [],
    )


def owned_conversation(db: Session, conversation_id: str, user_id: str) -> ReviewConversation:
    conversation = db.get(ReviewConversation, conversation_id)
    if conversation is None or conversation.user_id != user_id:
        raise HTTPException(status_code=404, detail="复盘助手会话不存在")
    return conversation


def get_review_entry(db: Session, review_id: str, entry_id: int, user_id: str) -> tuple[Review, ReviewEntry]:
    review = db.get(Review, review_id)
    if review is None or review.user_id != user_id:
        raise HTTPException(status_code=404, detail="复盘不存在")
    entry = db.get(ReviewEntry, entry_id)
    if entry is None or entry.review_id != review.id:
        raise HTTPException(status_code=404, detail="复盘决策点不存在")
    return review, entry


@router.post(
    "/api/reviews/{review_id}/entries/{entry_id}/assistant/conversation",
    response_model=ReviewAssistantConversationOut,
    response_model_by_alias=False,
)
def create_or_get_conversation(
    review_id: str,
    entry_id: int,
    db: Session = Depends(get_db),
) -> ReviewAssistantConversationOut:
    user = current_user(db)
    review, entry = get_review_entry(db, review_id, entry_id, user.id)
    compiled = compiler.compile(review, entry)
    conversation = db.scalar(
        select(ReviewConversation).where(
            ReviewConversation.user_id == user.id,
            ReviewConversation.review_id == review.id,
            ReviewConversation.review_entry_id == entry.id,
        ),
    )
    if conversation is None:
        conversation = ReviewConversation(
            user_id=user.id,
            review_id=review.id,
            review_entry_id=entry.id,
            context_version=CONTEXT_VERSION,
            context_hash=compiled.context_hash,
            title=f"{round_label(entry.kyoku_index)} 第{entry.junme}巡",
        )
        db.add(conversation)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            conversation = db.scalar(
                select(ReviewConversation).where(
                    ReviewConversation.user_id == user.id,
                    ReviewConversation.review_id == review.id,
                    ReviewConversation.review_entry_id == entry.id,
                ),
            )
            if conversation is None:
                raise
        db.refresh(conversation)
    elif conversation.context_hash != compiled.context_hash:
        conversation.context_hash = compiled.context_hash
        conversation.context_version = CONTEXT_VERSION
        db.commit()
        db.refresh(conversation)
    return serialize_conversation(db, conversation)


@router.get(
    "/api/review-assistant/conversations/{conversation_id}",
    response_model=ReviewAssistantConversationOut,
    response_model_by_alias=False,
)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
) -> ReviewAssistantConversationOut:
    user = current_user(db)
    conversation = owned_conversation(db, conversation_id, user.id)
    return serialize_conversation(db, conversation)


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def conversation_history(db: Session, conversation_id: str, exclude_message_id: str) -> list[dict[str, str]]:
    messages = db.scalars(
        select(ReviewMessage)
        .where(
            ReviewMessage.conversation_id == conversation_id,
            ReviewMessage.status == "completed",
            ReviewMessage.id != exclude_message_id,
            or_(
                ReviewMessage.reply_to_message_id.is_(None),
                ReviewMessage.reply_to_message_id != exclude_message_id,
            ),
        )
        .order_by(ReviewMessage.created_at.asc()),
    ).all()
    return [
        {"role": message.role, "content": message_text(message)}
        for message in messages[-16:]
        if message.role in {"user", "assistant"} and message_text(message)
    ]


async def stream_reply(
    *,
    conversation_id: str,
    user_message_id: str,
    assistant_message_id: str,
    answer_mode: str,
) -> AsyncIterator[str]:
    started_at = time.perf_counter()
    db = SessionLocal()
    try:
        conversation = db.get(ReviewConversation, conversation_id)
        user_message = db.get(ReviewMessage, user_message_id)
        assistant_message = db.get(ReviewMessage, assistant_message_id)
        if conversation is None or user_message is None or assistant_message is None:
            yield sse_event("message.failed", {"message_id": assistant_message_id, "detail": "会话状态已失效"})
            return
        review = db.get(Review, conversation.review_id)
        entry = db.get(ReviewEntry, conversation.review_entry_id)
        if review is None or entry is None:
            yield sse_event("message.failed", {"message_id": assistant_message_id, "detail": "复盘上下文不存在"})
            return

        compiled = compiler.compile(review, entry)
        conversation.context_hash = compiled.context_hash
        conversation.context_version = CONTEXT_VERSION
        assistant_message.context_hash = compiled.context_hash
        db.commit()

        yield sse_event(
            "message.started",
            {
                "message_id": assistant_message.id,
                "context_hash": compiled.context_hash,
                "provider_mode": provider_mode(),
            },
        )
        provider = get_review_assistant_provider()
        result = None
        first_token_ms = None
        async for event in provider.stream(
            decision_context=compiled.payload,
            history=conversation_history(db, conversation.id, user_message.id),
            question=message_text(user_message),
            answer_mode=answer_mode,
        ):
            if event.delta:
                if first_token_ms is None:
                    first_token_ms = int((time.perf_counter() - started_at) * 1000)
                yield sse_event(
                    "message.delta",
                    {"message_id": assistant_message.id, "delta": event.delta},
                )
            if event.result is not None:
                result = event.result
        if result is None:
            raise ReviewAssistantProviderError("大模型服务未返回完成事件")

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        explanation = result.explanation or {}
        referenced_ids = {
            evidence_id
            for section in ("key_points", "comparison", "uncertainties")
            for item in explanation.get(section, [])
            if isinstance(item, dict)
            for evidence_id in item.get("evidence_ids", [])
            if isinstance(evidence_id, str)
        }
        evidence = [
            item
            for item in compiled.payload.get("evidence_ledger", [])
            if isinstance(item, dict) and item.get("id") in referenced_ids
        ]
        assistant_message.content_json = {
            "text": result.text,
            "explanation": explanation,
            "fallback_reason": result.fallback_reason,
            "sources": {
                "round": compiled.payload["decision"]["round"],
                "turn": compiled.payload["decision"]["turn"],
                "actual_action": compiled.payload["engine_analysis"]["actual_action_label"],
                "recommended_action": compiled.payload["engine_analysis"]["recommended_action_label"],
                "limitations": compiled.payload["derived_facts"]["data_limitations"],
                "evidence": evidence,
                "fallback_reason": result.fallback_reason,
            },
        }
        assistant_message.status = "completed"
        assistant_message.model_provider = result.provider
        assistant_message.model_name = result.model
        assistant_message.prompt_version = PROMPT_VERSION
        assistant_message.input_tokens = result.input_tokens
        assistant_message.output_tokens = result.output_tokens
        assistant_message.first_token_ms = first_token_ms or latency_ms
        assistant_message.latency_ms = latency_ms
        db.commit()
        db.refresh(assistant_message)
        yield sse_event(
            "message.completed",
            {
                "message": serialize_message(assistant_message).model_dump(mode="json"),
                "sources": assistant_message.content_json["sources"],
            },
        )
    except asyncio.CancelledError:
        db.rollback()
        assistant_message = db.get(ReviewMessage, assistant_message_id)
        if assistant_message is not None:
            assistant_message.status = "cancelled"
            assistant_message.error_code = "cancelled"
            assistant_message.content_json = {"text": "生成已取消"}
            db.commit()
        raise
    except ReviewAssistantProviderError as exc:
        db.rollback()
        assistant_message = db.get(ReviewMessage, assistant_message_id)
        if assistant_message is not None:
            assistant_message.status = "failed"
            assistant_message.error_code = "provider_error"
            assistant_message.content_json = {"text": str(exc)}
            db.commit()
        yield sse_event("message.failed", {"message_id": assistant_message_id, "detail": str(exc)})
    except Exception:
        db.rollback()
        assistant_message = db.get(ReviewMessage, assistant_message_id)
        if assistant_message is not None:
            assistant_message.status = "failed"
            assistant_message.error_code = "internal_error"
            assistant_message.content_json = {"text": "生成解释时发生内部错误"}
            db.commit()
        yield sse_event("message.failed", {"message_id": assistant_message_id, "detail": "生成解释时发生内部错误"})
    finally:
        db.close()


def prepare_reply(
    db: Session,
    *,
    conversation: ReviewConversation,
    content: str,
    client_request_id: str | None,
) -> tuple[ReviewMessage, ReviewMessage]:
    if client_request_id:
        existing_user_message = db.scalar(
            select(ReviewMessage).where(
                ReviewMessage.conversation_id == conversation.id,
                ReviewMessage.client_request_id == client_request_id,
            ),
        )
        if existing_user_message is not None:
            existing_reply = db.scalar(
                select(ReviewMessage)
                .where(ReviewMessage.reply_to_message_id == existing_user_message.id)
                .order_by(ReviewMessage.created_at.desc()),
            )
            if existing_reply is not None:
                return existing_user_message, existing_reply

    user_message = ReviewMessage(
        conversation_id=conversation.id,
        role="user",
        content_json={"text": content},
        status="completed",
        context_hash=conversation.context_hash,
        client_request_id=client_request_id,
    )
    db.add(user_message)
    db.flush()
    assistant_message = ReviewMessage(
        conversation_id=conversation.id,
        reply_to_message_id=user_message.id,
        role="assistant",
        content_json={"text": ""},
        status="streaming",
        context_hash=conversation.context_hash,
        prompt_version=PROMPT_VERSION,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    return user_message, assistant_message


@router.post("/api/review-assistant/conversations/{conversation_id}/messages")
def create_message(
    conversation_id: str,
    payload: ReviewAssistantMessageRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    user = current_user(db)
    conversation = owned_conversation(db, conversation_id, user.id)
    user_message, assistant_message = prepare_reply(
        db,
        conversation=conversation,
        content=payload.content.strip(),
        client_request_id=payload.client_request_id,
    )
    if assistant_message.status == "completed":
        async def replay() -> AsyncIterator[str]:
            yield sse_event(
                "message.completed",
                {"message": serialize_message(assistant_message).model_dump(mode="json")},
            )

        return StreamingResponse(replay(), media_type="text/event-stream")
    return StreamingResponse(
        stream_reply(
            conversation_id=conversation.id,
            user_message_id=user_message.id,
            assistant_message_id=assistant_message.id,
            answer_mode=payload.answer_mode,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/api/review-assistant/messages/{message_id}/regenerate")
def regenerate_message(
    message_id: str,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    user = current_user(db)
    original = db.get(ReviewMessage, message_id)
    if original is None or original.role != "assistant" or original.reply_to_message_id is None:
        raise HTTPException(status_code=404, detail="助手消息不存在")
    conversation = owned_conversation(db, original.conversation_id, user.id)
    user_message = db.get(ReviewMessage, original.reply_to_message_id)
    if user_message is None:
        raise HTTPException(status_code=409, detail="原始问题不存在")
    replacement = ReviewMessage(
        conversation_id=conversation.id,
        reply_to_message_id=user_message.id,
        role="assistant",
        content_json={"text": ""},
        status="streaming",
        context_hash=conversation.context_hash,
        prompt_version=PROMPT_VERSION,
    )
    db.add(replacement)
    db.commit()
    db.refresh(replacement)
    return StreamingResponse(
        stream_reply(
            conversation_id=conversation.id,
            user_message_id=user_message.id,
            assistant_message_id=replacement.id,
            answer_mode="concise",
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/api/review-assistant/messages/{message_id}/feedback",
    response_model=ReviewAssistantFeedbackOut,
    response_model_by_alias=False,
)
def submit_feedback(
    message_id: str,
    payload: ReviewAssistantFeedbackRequest,
    db: Session = Depends(get_db),
) -> ReviewAssistantFeedbackOut:
    user = current_user(db)
    message = db.get(ReviewMessage, message_id)
    if message is None or message.role != "assistant":
        raise HTTPException(status_code=404, detail="助手消息不存在")
    owned_conversation(db, message.conversation_id, user.id)
    feedback = db.scalar(
        select(ReviewMessageFeedback).where(
            ReviewMessageFeedback.message_id == message.id,
            ReviewMessageFeedback.user_id == user.id,
        ),
    )
    if feedback is None:
        feedback = ReviewMessageFeedback(message_id=message.id, user_id=user.id, rating=payload.rating)
        db.add(feedback)
    feedback.rating = payload.rating
    feedback.reason = payload.reason
    db.commit()
    return ReviewAssistantFeedbackOut(message_id=message.id, rating=feedback.rating, reason=feedback.reason)
