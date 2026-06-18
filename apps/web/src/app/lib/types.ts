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

export interface CreatePlaySessionRequest {
  username: string;
  ai_level: "normal" | "hard";
  match_type: "tonpu" | "hanchan";
  seat: "random" | "east" | "south" | "west" | "north";
  start_points: number;
  aka_dora: 0 | 3;
  kuitan: boolean;
  allow_south_entry: boolean;
  ai_opponents?: Array<{
    style: string;
    difficulty: "normal" | "hard";
  }>;
}

export interface PlayServiceStatus {
  name: string;
  host: string;
  port: number;
  running: boolean;
  reachable: boolean;
  managed: boolean;
  detail?: string | null;
}

export interface PlaySession {
  session_id: string;
  match_id: string;
  username: string;
  status: string;
  host: string;
  websocket_port: number;
  web_port: number;
  game_url: string;
  launch_url: string;
  services: PlayServiceStatus[];
}

export interface PlayMatch {
  id: string;
  status: string;
  match_type?: string | null;
  source: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  event_count: number;
  reviewable_event_count: number;
  completed_kyoku_count: number;
  target_actor?: number | null;
  target_player_label?: string | null;
  latest_review_job?: {
    id: string;
    status: ReviewJobStatus;
    event_count?: number | null;
    review_id?: string | null;
    error_message?: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPlayMatches {
  items: PlayMatch[];
  page: number;
  page_size: number;
  total: number;
}

export interface ClassicGameHand {
  index: number;
  label: string;
  scores: number[];
  decision_count: number;
}

export interface ClassicGame {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  year: number;
  match_type: string;
  players: string[];
  tags: string[];
  summary: string;
  hand_count: number;
  decision_count: number;
  hands: ClassicGameHand[];
}

export interface ClassicTrainingDecision {
  decision_index: number;
  total_decisions: number;
  hand_index: number;
  hand_label: string;
  turn: number;
  action_type: string;
  state_snapshot: Record<string, unknown>;
  options: Array<{
    type: "dahai";
    pai: string;
  }>;
}

export interface ClassicTrainingComparison {
  decision_index: number;
  hand_index: number;
  hand_label: string;
  turn: number;
  actual_action: Record<string, unknown>;
  original_action: Record<string, unknown>;
  is_same: boolean;
}

export interface ClassicTrainingHandSummary {
  hand_index: number;
  hand_label: string;
  decision_count: number;
  same_count: number;
  different_count: number;
  agreement_rate: number;
}

export interface ClassicTrainingComparisonSummary {
  decision_count: number;
  same_count: number;
  different_count: number;
  agreement_rate: number;
  route_label: string;
  route_description: string;
  hands: ClassicTrainingHandSummary[];
}

export interface ClassicTrainingSession {
  match_id: string;
  status: string;
  username: string;
  game: ClassicGame;
  start_hand_index: number;
  answered_count: number;
  total_decisions: number;
  current_decision?: ClassicTrainingDecision | null;
  history: ClassicTrainingComparison[];
  comparison_summary?: ClassicTrainingComparisonSummary | null;
  result?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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

export interface ReviewAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "completed" | "failed" | "cancelled";
  model_provider?: string | null;
  model_name?: string | null;
  prompt_version?: string | null;
  context_hash: string;
  latency_ms?: number | null;
  created_at: string;
  feedback?: "helpful" | "unhelpful" | "error" | null;
  sources?: {
    round?: string;
    turn?: number;
    actual_action?: string;
    recommended_action?: string;
    limitations?: string[];
    fallback_reason?: string | null;
    evidence?: Array<{
      id: string;
      kind: "table" | "engine" | "derived" | "limitation";
      statement: string;
      data?: Record<string, unknown>;
    }>;
  } | null;
  explanation?: {
    schema_version: "decision-explanation.v1";
    recommended_action: string;
    actual_action: string;
    verdict: string;
    key_points: Array<{ claim: string; evidence_ids: string[] }>;
    comparison: Array<{
      dimension: "efficiency" | "speed" | "value" | "defense" | "flexibility" | "placement";
      actual_effect: string;
      recommended_effect: string;
      evidence_ids: string[];
    }>;
    uncertainties: Array<{ claim: string; evidence_ids: string[] }>;
    teaching_rule: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

export interface ReviewAssistantConversation {
  id: string;
  review_id: string;
  entry_id: number;
  context_version: string;
  context_hash: string;
  title: string;
  provider_mode: "llm" | "deterministic";
  messages: ReviewAssistantMessage[];
  suggested_questions: string[];
}

export interface ReviewAssistantStreamHandlers {
  onStarted?: (payload: { message_id: string; context_hash: string; provider_mode: string }) => void;
  onDelta?: (payload: { message_id: string; delta: string }) => void;
  onCompleted?: (payload: { message: ReviewAssistantMessage }) => void;
  onFailed?: (payload: { message_id: string; detail: string }) => void;
}
