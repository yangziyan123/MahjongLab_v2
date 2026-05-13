import type {
  CreatePlaySessionRequest,
  CreateReviewJobRequest,
  DashboardSummary,
  MistakeItem,
  PaginatedMistakeItems,
  PlayMatch,
  PlaySession,
  PaginatedReviewEntries,
  PaginatedReviews,
  ReplaySourceOption,
  Review,
  ReviewEntry,
  ReviewJob,
  ReviewJobResult,
  UploadResponse,
  UserProfile,
} from "./types";

const REVIEW_ENTRY_PAGE_SIZE = 200;
const MISTAKE_PAGE_SIZE = 100;

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

export function getPlayMatchExportUrl(matchId: string) {
  return `/api/play/matches/${matchId}/export`;
}

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>("/api/dashboard/summary");
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
  page?: number;
  page_size?: number;
}) {
  return apiRequest<PaginatedReviews>(`/api/reviews${buildQuery(params)}`);
}

export function getReview(reviewId: string) {
  return apiRequest<Review>(`/api/reviews/${reviewId}`);
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

export function createMistakeItem(reviewId: string, payload: {
  review_entry_id: number;
  note?: string | null;
  tags?: string[];
}) {
  return apiRequest<MistakeItem>(`/api/reviews/${reviewId}/mistakes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listMistakes(params: {
  q?: string;
  review_id?: string;
  category?: string;
  decision_type?: string;
  page?: number;
  page_size?: number;
}) {
  return apiRequest<PaginatedMistakeItems>(`/api/mistakes${buildQuery(params)}`);
}

export async function listAllMistakes(params: {
  q?: string;
  review_id?: string;
  category?: string;
  decision_type?: string;
}) {
  const items: MistakeItem[] = [];
  let page = 1;

  while (true) {
    const response = await listMistakes({
      ...params,
      page,
      page_size: MISTAKE_PAGE_SIZE,
    });
    items.push(...response.items);

    if (items.length >= response.total || response.items.length === 0) {
      return items;
    }

    page += 1;
  }
}

export function deleteMistakeItem(mistakeId: string) {
  return apiRequest<void>(`/api/mistakes/${mistakeId}`, {
    method: "DELETE",
  });
}
