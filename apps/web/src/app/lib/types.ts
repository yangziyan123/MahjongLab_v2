export type ReviewJobStatus =
  | "created"
  | "parsing"
  | "queued"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled";

export interface UserProfile {
  id: string;
  display_name: string;
  locale: string;
  timezone: string;
}

export interface DashboardSummary {
  review_count: number;
  completed_job_count: number;
  failed_job_count: number;
  mistake_count: number;
}

export interface ReplaySourceOption {
  key: string;
  label: string;
  enabled: boolean;
}

export interface UploadResponse {
  file_key: string;
  filename: string;
  size: number;
}

export interface CreateReviewJobRequest {
  source_type: string;
  platform?: string | null;
  source: Record<string, unknown>;
  options?: Record<string, unknown>;
  target_player_ref?: string | null;
}

export interface ReviewJob {
  id: string;
  status: ReviewJobStatus;
  progress: number;
  step: string;
  source_type: string;
  platform?: string | null;
  source: Record<string, unknown>;
  options: Record<string, unknown>;
  target_player_ref?: string | null;
  target_actor?: number | null;
  review_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  queued_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ReviewJobResult {
  task_id: string;
  status: ReviewJobStatus;
  review_id?: string | null;
  report_url?: string | null;
}

export interface Review {
  id: string;
  job_id: string;
  platform?: string | null;
  target_actor: number;
  target_player_label?: string | null;
  engine_name: string;
  engine_version: string;
  model_tag?: string | null;
  reviewed_decision_count: number;
  match_decision_count: number;
  high_deviation_count: number;
  medium_deviation_count: number;
  optimal_count: number;
  rating?: number | null;
  temperature?: number | null;
  summary: Record<string, unknown>;
  stats: Record<string, unknown>;
  result_object_key: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewDetailCandidate {
  expected_action?: Record<string, unknown>;
  best_q_value?: number | null;
  prob?: number | null;
  engine_meta?: Record<string, unknown>;
}

export interface ReviewEntry {
  id: number;
  review_id: string;
  seq: number;
  kyoku_index: number;
  honba: number;
  junme: number;
  tiles_left: number;
  last_actor?: number | null;
  tile?: string | null;
  decision_type: string;
  actual_action?: Record<string, unknown> | null;
  expected_action: Record<string, unknown>;
  is_match: boolean;
  deviation_level: string;
  delta_score?: number | null;
  shanten?: number | null;
  at_furiten?: boolean | null;
  details: ReviewDetailCandidate[];
  state_snapshot: Record<string, unknown>;
  tags: string[];
  created_at: string;
}

export interface PaginatedReviews {
  items: Review[];
  page: number;
  page_size: number;
  total: number;
}

export interface PaginatedReviewEntries {
  items: ReviewEntry[];
  page: number;
  page_size: number;
  total: number;
}

export interface MistakeItem {
  id: string;
  review_id: string;
  review_entry_id: number;
  platform?: string | null;
  target_actor: number;
  target_player_label?: string | null;
  entry_seq: number;
  kyoku_index: number;
  honba: number;
  junme: number;
  decision_type: string;
  deviation_level: string;
  category: string;
  note?: string | null;
  tags: string[];
  actual_action?: Record<string, unknown> | null;
  expected_action: Record<string, unknown>;
  state_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaginatedMistakeItems {
  items: MistakeItem[];
  page: number;
  page_size: number;
  total: number;
}
