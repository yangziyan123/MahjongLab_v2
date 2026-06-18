import type {
  ClassicGame,
  ClassicTrainingSession,
  CreatePlaySessionRequest,
  CreateReviewJobRequest,
  PaginatedPlayMatches,
  PlayMatch,
  PlaySession,
  PaginatedReviewEntries,
  PaginatedReviews,
  ReplaySourceOption,
  Review,
  ReviewAssistantConversation,
  ReviewAssistantMessage,
  ReviewAssistantStreamHandlers,
  ReviewEntry,
  ReviewJob,
  ReviewJobResult,
  UploadResponse,
  UserProfile,
} from "./types";

const REVIEW_ENTRY_PAGE_SIZE = 200;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.detail === "string") {
        detail = errorPayload.detail;
      }
    } catch {
      // ignore JSON parse failure for non-JSON error bodies
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getMe() {
  return apiRequest<UserProfile>("/api/me");
}

export async function listClassicGames() {
  const payload = await apiRequest<{ items: ClassicGame[] }>("/api/classic-games");
  return payload.items;
}

export function getClassicGame(gameId: string) {
  return apiRequest<ClassicGame>(`/api/classic-games/${gameId}`);
}

export function createClassicTrainingSession(payload: {
  game_id: string;
  start_hand_index: number;
  username: string;
}) {
  return apiRequest<ClassicTrainingSession>("/api/classic-training/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getClassicTrainingSession(matchId: string) {
  return apiRequest<ClassicTrainingSession>(`/api/classic-training/sessions/${matchId}`);
}

export function submitClassicTrainingAction(matchId: string, payload: { type: "dahai"; pai: string }) {
  return apiRequest<ClassicTrainingSession>(`/api/classic-training/sessions/${matchId}/actions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlaySession() {
  return apiRequest<PlaySession | null>("/api/play/session");
}

export function createPlaySession(payload: CreatePlaySessionRequest) {
  return apiRequest<PlaySession>("/api/play/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlayMatch(matchId: string) {
  return apiRequest<PlayMatch>(`/api/play/matches/${matchId}`);
}

export function listPlayMatches(params: {
  q?: string;
  status?: string;
  match_type?: string;
  date_range?: string;
  page?: number;
  page_size?: number;
}) {
  return apiRequest<PaginatedPlayMatches>(`/api/play/matches${buildQuery(params)}`);
}

export function startPlayMatchReview(matchId: string) {
  return apiRequest<ReviewJob>(`/api/play/matches/${matchId}/review`, {
    method: "POST",
  });
}

export function getPlayMatchExportUrl(matchId: string) {
  return `/api/play/matches/${matchId}/export`;
}

export async function listReplaySources() {
  const payload = await apiRequest<{ items: ReplaySourceOption[] }>("/api/platforms/replay-sources");
  return payload.items;
}

export function uploadReplayFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<UploadResponse>("/api/uploads", {
    method: "POST",
    body: formData,
  });
}

export function createReviewJob(payload: CreateReviewJobRequest) {
  return apiRequest<ReviewJob>("/api/review-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReviewJob(taskId: string) {
  return apiRequest<ReviewJob>(`/api/review-jobs/${taskId}`);
}

export function getReviewJobResult(taskId: string) {
  return apiRequest<ReviewJobResult>(`/api/review-jobs/${taskId}/result`);
}

export function retryReviewJob(taskId: string) {
  return apiRequest<ReviewJob>(`/api/review-jobs/${taskId}/retry`, {
    method: "POST",
  });
}

export function listReviews(params: {
  q?: string;
  platform?: string;
  date_range?: string;
  page?: number;
  page_size?: number;
}) {
  return apiRequest<PaginatedReviews>(`/api/reviews${buildQuery(params)}`);
}

export function getReview(reviewId: string) {
  return apiRequest<Review>(`/api/reviews/${reviewId}`);
}

export function getReviewExportUrl(
  reviewId: string,
  anonymous?: boolean,
) {
  return `/api/reviews/${reviewId}/export${buildQuery({
    anonymous: anonymous === undefined ? undefined : String(anonymous),
  })}`;
}

export function listReviewEntries(params: {
  reviewId: string;
  kyoku?: number;
  deviation_level?: string;
  decision_type?: string;
  page?: number;
  page_size?: number;
}) {
  const { reviewId, ...query } = params;
  return apiRequest<PaginatedReviewEntries>(
    `/api/reviews/${reviewId}/entries${buildQuery(query)}`,
  );
}

export async function listAllReviewEntries(params: {
  reviewId: string;
  kyoku?: number;
  deviation_level?: string;
  decision_type?: string;
}) {
  const items: ReviewEntry[] = [];
  let page = 1;

  while (true) {
    const response = await listReviewEntries({
      ...params,
      page,
      page_size: REVIEW_ENTRY_PAGE_SIZE,
    });
    items.push(...response.items);

    if (items.length >= response.total || response.items.length === 0) {
      return items;
    }

    page += 1;
  }
}

export function deleteReview(reviewId: string) {
  return apiRequest<void>(`/api/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

export function createReviewAssistantConversation(reviewId: string, entryId: number) {
  return apiRequest<ReviewAssistantConversation>(
    `/api/reviews/${reviewId}/entries/${entryId}/assistant/conversation`,
    { method: "POST" },
  );
}

export function getReviewAssistantConversation(conversationId: string) {
  return apiRequest<ReviewAssistantConversation>(
    `/api/review-assistant/conversations/${conversationId}`,
  );
}

function dispatchAssistantEvent(
  event: string,
  data: string,
  handlers: ReviewAssistantStreamHandlers,
) {
  const payload = JSON.parse(data);
  if (event === "message.started") {
    handlers.onStarted?.(payload);
  } else if (event === "message.delta") {
    handlers.onDelta?.(payload);
  } else if (event === "message.completed") {
    handlers.onCompleted?.(payload);
  } else if (event === "message.failed") {
    handlers.onFailed?.(payload);
  }
}

async function readAssistantStream(
  response: Response,
  handlers: ReviewAssistantStreamHandlers,
) {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      // keep the HTTP status when the error body is not JSON
    }
    throw new ApiError(response.status, detail);
  }
  if (!response.body) {
    throw new ApiError(502, "助手返回了空响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data += line.slice(6);
        }
      }
      if (event && data) {
        dispatchAssistantEvent(event, data, handlers);
      }
    }
    if (done) {
      break;
    }
  }
  if (buffer.trim()) {
    let event = "";
    let data = "";
    for (const line of buffer.split("\n")) {
      if (line.startsWith("event: ")) {
        event = line.slice(7);
      } else if (line.startsWith("data: ")) {
        data += line.slice(6);
      }
    }
    if (event && data) {
      dispatchAssistantEvent(event, data, handlers);
    }
  }
}

export async function streamReviewAssistantMessage(
  conversationId: string,
  payload: {
    content: string;
    client_request_id: string;
  },
  handlers: ReviewAssistantStreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `/api/review-assistant/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    },
  );
  return readAssistantStream(response, handlers);
}

export async function regenerateReviewAssistantMessage(
  messageId: string,
  handlers: ReviewAssistantStreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/review-assistant/messages/${messageId}/regenerate`, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    signal,
  });
  return readAssistantStream(response, handlers);
}

export function submitReviewAssistantFeedback(
  messageId: string,
  rating: "helpful" | "unhelpful" | "error",
  reason?: string,
) {
  return apiRequest<{ message_id: string; rating: string; reason?: string | null }>(
    `/api/review-assistant/messages/${messageId}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({ rating, reason }),
    },
  );
}
