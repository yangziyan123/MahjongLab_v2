import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  createReviewAssistantConversation,
  regenerateReviewAssistantMessage,
  streamReviewAssistantMessage,
  submitReviewAssistantFeedback,
} from "../../lib/api";
import type {
  ReviewAssistantConversation,
  ReviewAssistantMessage,
  ReviewEntry,
} from "../../lib/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const ERROR_REASONS = ["与牌桌不符", "与引擎结论不符", "使用了不可见信息", "解释太复杂"];

function temporaryMessage(role: "user" | "assistant", content: string): ReviewAssistantMessage {
  return {
    id: `temporary-${role}-${crypto.randomUUID()}`,
    role,
    content,
    status: role === "assistant" ? "streaming" : "completed",
    context_hash: "",
    created_at: new Date().toISOString(),
  };
}

function MessageEvidence({ message }: { message: ReviewAssistantMessage }) {
  if (!message.sources) {
    return null;
  }
  const {
    round,
    turn,
    actual_action,
    recommended_action,
    limitations = [],
    fallback_reason,
    evidence = [],
  } = message.sources;
  return (
    <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-700">
        本回答依据
        <ChevronDown className="h-3.5 w-3.5" />
      </summary>
      <div className="mt-2 space-y-1.5">
        <div>[牌桌] {round} 第 {turn} 巡</div>
        <div>[引擎] 实际 {actual_action}，推荐 {recommended_action}</div>
        {fallback_reason && <div>[降级] 大模型输出未通过校验，已使用本地解释。</div>}
        {evidence.length > 0 ? (
          evidence.map((item) => (
            <div key={item.id}>
              <span className="font-mono font-semibold text-slate-700">{item.id}</span>
              {" "}
              {item.statement}
            </div>
          ))
        ) : (
          limitations.map((limitation) => (
            <div key={limitation}>[限制] {limitation}</div>
          ))
        )}
      </div>
    </details>
  );
}

function AssistantMessageActions({
  message,
  onFeedback,
  onRegenerate,
  disabled,
}: {
  message: ReviewAssistantMessage;
  onFeedback: (rating: "helpful" | "unhelpful" | "error", reason?: string) => void;
  onRegenerate: () => void;
  disabled: boolean;
}) {
  const [showReasons, setShowReasons] = useState(false);
  if (message.status !== "completed") {
    return null;
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => onFeedback("helpful")}
          disabled={disabled}
          aria-label="这条解释有帮助"
        >
          {message.feedback === "helpful" ? <Check className="mr-1 h-3.5 w-3.5" /> : <ThumbsUp className="mr-1 h-3.5 w-3.5" />}
          有帮助
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => onFeedback("unhelpful")}
          disabled={disabled}
          aria-label="这条解释没有帮助"
        >
          <ThumbsDown className="mr-1 h-3.5 w-3.5" />
          没帮助
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => setShowReasons((value) => !value)}
          disabled={disabled}
        >
          <AlertCircle className="mr-1 h-3.5 w-3.5" />
          报告错误
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={onRegenerate}
          disabled={disabled}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          重新生成
        </Button>
      </div>
      {showReasons && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ERROR_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              onClick={() => {
                onFeedback("error", reason);
                setShowReasons(false);
              }}
            >
              {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewAssistantPanel({
  reviewId,
  entry,
  active,
}: {
  reviewId: string;
  entry: ReviewEntry;
  active: boolean;
}) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ReviewAssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);

  const conversationQuery = useQuery({
    queryKey: ["review-assistant-conversation", reviewId, entry.id],
    queryFn: () => createReviewAssistantConversation(reviewId, entry.id),
    enabled: active,
  });
  const conversation = conversationQuery.data;

  useEffect(() => {
    if (conversation && !isGenerating) {
      setMessages(conversation.messages);
    }
  }, [conversation, isGenerating]);

  useEffect(() => {
    const element = messageScrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const refreshConversation = async (value: ReviewAssistantConversation) => {
    await queryClient.invalidateQueries({
      queryKey: ["review-assistant-conversation", value.review_id, value.entry_id],
    });
  };

  const runStream = async (
    userContent: string | null,
    stream: (
      handlers: Parameters<typeof streamReviewAssistantMessage>[2],
      signal: AbortSignal,
    ) => Promise<void>,
  ) => {
    if (!conversation || isGenerating) {
      return;
    }
    const userMessage = userContent ? temporaryMessage("user", userContent) : null;
    const assistantMessage = temporaryMessage("assistant", "");
    setMessages((current) => [...current, ...(userMessage ? [userMessage] : []), assistantMessage]);
    setIsGenerating(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await stream(
        {
          onDelta: ({ delta }) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
          onCompleted: ({ message }) => {
            setMessages((current) =>
              current.map((item) => (item.id === assistantMessage.id ? message : item)),
            );
          },
          onFailed: ({ detail }) => {
            setError(detail);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, status: "failed", content: detail }
                  : message,
              ),
            );
          },
        },
        controller.signal,
      );
      await refreshConversation(conversation);
    } catch (streamError) {
      if ((streamError as Error).name === "AbortError") {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  status: "cancelled",
                  content: message.content || "已停止生成",
                }
              : message,
          ),
        );
      } else {
        const detail = streamError instanceof Error ? streamError.message : "生成解释失败";
        setError(detail);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, status: "failed", content: detail }
              : message,
          ),
        );
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const sendQuestion = async (content: string) => {
    const question = content.trim();
    if (!conversation || !question || isGenerating) {
      return;
    }
    setDraft("");
    await runStream(question, (handlers, signal) =>
      streamReviewAssistantMessage(
        conversation.id,
        {
          content: question,
          client_request_id: crypto.randomUUID(),
        },
        handlers,
        signal,
      ),
    );
  };

  const regenerate = async (messageId: string) => {
    await runStream(null, (handlers, signal) =>
      regenerateReviewAssistantMessage(messageId, handlers, signal),
    );
  };

  const feedback = async (
    messageId: string,
    rating: "helpful" | "unhelpful" | "error",
    reason?: string,
  ) => {
    try {
      await submitReviewAssistantFeedback(messageId, rating, reason);
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, feedback: rating } : message)),
      );
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "提交反馈失败");
    }
  };

  if (conversationQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        正在读取本手上下文
      </div>
    );
  }

  if (conversationQuery.isError || !conversation) {
    return (
      <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
        无法建立本手对话，请稍后重试。
      </div>
    );
  }

  const hasMessages = messages.length > 0;
  return (
    <div className="flex min-h-[520px] flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Bot className="h-4 w-4" />
            {conversation.title}
          </div>
          <div className="mt-1 text-xs text-slate-500">对话仅使用当前决策时可见的信息</div>
        </div>
        <Badge variant={conversation.provider_mode === "llm" ? "default" : "secondary"}>
          {conversation.provider_mode === "llm" ? "大模型" : "本地解释"}
        </Badge>
      </div>

      <div ref={messageScrollRef} className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
        {!hasMessages ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">解释当前决策</h3>
            <p className="mt-2 max-w-[30ch] text-sm leading-6 text-slate-500">
              助手会结合牌桌快照、实际动作和复盘引擎结论，说明推荐理由与可复用的判断方法。
            </p>
            <Button
              className="mt-5"
              onClick={() => sendQuestion("请解释这一手，并给出可复用的判断方法。")}
              disabled={isGenerating}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              解释这一手
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-xl bg-slate-900 px-4 py-3 text-sm leading-6 text-white"
                    : "mr-2 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-800"
                }
              >
                {message.role === "assistant" && (
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-700">
                    <Bot className="h-3.5 w-3.5" />
                    复盘助手
                    {message.status === "streaming" && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{message.content || (message.status === "streaming" ? "正在组织解释..." : "")}</div>
                {message.role === "assistant" && <MessageEvidence message={message} />}
                {message.role === "assistant" && !message.id.startsWith("temporary-") && (
                  <AssistantMessageActions
                    message={message}
                    onFeedback={(rating, reason) => feedback(message.id, rating, reason)}
                    onRegenerate={() => regenerate(message.id)}
                    disabled={isGenerating}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white pt-3">
        {conversation.suggested_questions.length > 0 && !isGenerating && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {conversation.suggested_questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendQuestion(question)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="mb-2 flex items-center text-xs text-rose-700">
            <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
            {error}
          </div>
        )}
        <div className="mb-2 flex items-center justify-end">
          {isGenerating ? (
            <button
              type="button"
              className="text-xs font-medium text-rose-600 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              onClick={() => abortRef.current?.abort()}
            >
              停止生成
            </button>
          ) : (
            <span className="text-xs text-slate-400">{draft.length}/2000</span>
          )}
        </div>
        <div className="relative">
          <Textarea
            value={draft}
            maxLength={2000}
            placeholder="继续问这一手，例如：为什么不是我的打法？"
            className="min-h-20 pr-12"
            disabled={isGenerating}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion(draft);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={() => sendQuestion(draft)}
            disabled={!draft.trim() || isGenerating}
            aria-label="发送问题"
          >
            {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center text-[11px] text-slate-400">
          <MessageCircleQuestion className="mr-1 h-3 w-3" />
          回答可能有误，请以牌桌事实和复盘引擎数据为准
        </div>
      </div>
    </div>
  );
}
