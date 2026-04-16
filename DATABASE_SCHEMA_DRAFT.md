# MahjongLab 数据库表结构初稿

## 1. 目标

这份初稿服务于当前两个业务主线：

- 复盘链路
  - `ReviewJob`
  - `Review`
- 对战链路
  - `Match`
  - `MatchResult`

同时补齐这些核心支持表：

- `users`
- `review_entries`
- `match_events`

数据库默认目标为 `PostgreSQL 16`。

## 2. 设计原则

### 2.1 命名

- 表名统一用复数：`review_jobs`、`reviews`
- 主键统一为 `uuid`
- 审计字段统一保留：
  - `created_at`
  - `updated_at`

### 2.2 结构原则

- 高查询频率字段拆成独立列
- 结构可能演进、但暂不稳定的字段先使用 `jsonb`
- 对局与复盘的完整原始大对象不直接塞数据库正文，优先放对象存储，只在数据库保存 `object_key`

### 2.3 日志原则

- 对局内部唯一事实来源：`match_events`
- 复盘完整结果唯一事实来源：对象存储中的完整 review JSON
- 数据库承担：
  - 列表查询
  - 状态查询
  - 摘要展示
  - 筛选
  - 历史记录

## 3. 核心关系

```text
users
  ├─< review_jobs
  │     └─1 reviews
  │          └─< review_entries
  │
  └─< matches
        ├─< match_events
        └─1 match_results

matches ──────< review_jobs   (内部对局结束后可自动创建复盘任务)
review_jobs ── 1 reviews      (一个成功任务生成一个复盘结果)
match_results ─ optional → review_jobs
```

## 4. 状态枚举建议

### 4.1 `review_job_status`

- `created`
- `parsing`
- `queued`
- `analyzing`
- `completed`
- `failed`
- `cancelled`

### 4.2 `review_source_type`

- `internal_match`
- `tenhou_url`
- `tenhou_id`
- `majsoul_url`
- `upload_file`
- `inline_json`

### 4.3 `match_status`

- `created`
- `waiting`
- `in_progress`
- `finished`
- `aborted`
- `failed`

### 4.4 `match_type`

- `tonpu`
- `hanchan`

### 4.5 `deviation_level`

- `none`
- `low`
- `medium`
- `high`

### 4.6 `decision_type`

- `discard`
- `riichi`
- `chi`
- `pon`
- `kan`
- `agari`
- `ryukyoku`
- `pass`
- `other`

## 5. 表结构

### 5.1 `users`

用途：

- 用户基础资料
- 数据归属

关键说明：

- 当前版本只保留最小字段
- 后续若接 OAuth，可增加 `auth_providers` 表

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 用户 ID |
| `email` | `text` | UNIQUE NULL | 邮箱 |
| `display_name` | `text` | NOT NULL | 展示昵称 |
| `avatar_url` | `text` | NULL | 头像 |
| `locale` | `text` | NOT NULL DEFAULT `'zh-CN'` | 语言 |
| `timezone` | `text` | NOT NULL DEFAULT `'Asia/Shanghai'` | 时区 |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL | 更新时间 |

### 5.2 `review_jobs`

用途：

- 记录一次复盘请求
- 供任务页 `/review/task/:taskId` 使用

关键说明：

- 一个 `review_job` 表示“一次复盘任务”
- 任务输入可能来自链接、ID、文件、内部对局，所以输入采用 `jsonb`

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 任务 ID |
| `user_id` | `uuid` | FK `users(id)` | 所属用户 |
| `match_id` | `uuid` | FK `matches(id)` NULL | 若来自内部对局，则关联对局 |
| `status` | `text` | NOT NULL | 任务状态 |
| `progress` | `smallint` | NOT NULL DEFAULT `0` | 0-100 |
| `step` | `text` | NOT NULL DEFAULT `'created'` | 当前步骤 |
| `source_type` | `text` | NOT NULL | 来源类型 |
| `platform` | `text` | NULL | `tenhou` / `majsoul` / `internal` |
| `source_payload` | `jsonb` | NOT NULL | 原始输入 |
| `options_json` | `jsonb` | NOT NULL DEFAULT `'{}'::jsonb` | 复盘参数 |
| `target_player_ref` | `text` | NULL | 用户选择的目标玩家标识 |
| `target_actor` | `smallint` | NULL | 解析后的座位 0-3 |
| `raw_input_object_key` | `text` | NULL | 原始文件对象存储键 |
| `normalized_mjai_object_key` | `text` | NULL | 转换后的 `mjai` 日志对象键 |
| `review_id` | `uuid` | FK `reviews(id)` NULL | 完成后写入 |
| `error_code` | `text` | NULL | 错误码 |
| `error_message` | `text` | NULL | 错误信息 |
| `attempt_count` | `integer` | NOT NULL DEFAULT `0` | 重试次数 |
| `queued_at` | `timestamptz` | NULL | 入队时间 |
| `started_at` | `timestamptz` | NULL | 开始分析时间 |
| `completed_at` | `timestamptz` | NULL | 完成时间 |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL | 更新时间 |

建议索引：

- `idx_review_jobs_user_created_at (user_id, created_at desc)`
- `idx_review_jobs_status_created_at (status, created_at desc)`
- `idx_review_jobs_match_id (match_id)`
- `idx_review_jobs_review_id (review_id)`

### 5.3 `reviews`

用途：

- 记录一份已经完成的复盘结果摘要
- 供报告页 `/review/report/:reportId` 使用

关键说明：

- 完整复盘大对象放对象存储
- 这里保存列表展示和摘要展示所需字段

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 报告 ID |
| `job_id` | `uuid` | UNIQUE FK `review_jobs(id)` | 来源任务 |
| `user_id` | `uuid` | FK `users(id)` | 所属用户 |
| `match_id` | `uuid` | FK `matches(id)` NULL | 若来自内部对局则关联 |
| `platform` | `text` | NULL | 平台 |
| `target_actor` | `smallint` | NOT NULL | 目标玩家座位 |
| `target_player_label` | `text` | NULL | 展示名 |
| `engine_name` | `text` | NOT NULL | 如 `mortal` |
| `engine_version` | `text` | NOT NULL | 引擎版本 |
| `model_tag` | `text` | NULL | 模型标签 |
| `lang` | `text` | NOT NULL DEFAULT `'zh-CN'` | 报告语言 |
| `reviewed_decision_count` | `integer` | NOT NULL DEFAULT `0` | 分析决策数 |
| `match_decision_count` | `integer` | NOT NULL DEFAULT `0` | 命中最优数等比对基数 |
| `high_deviation_count` | `integer` | NOT NULL DEFAULT `0` | 高偏差数 |
| `medium_deviation_count` | `integer` | NOT NULL DEFAULT `0` | 中偏差数 |
| `optimal_count` | `integer` | NOT NULL DEFAULT `0` | 最优数 |
| `rating` | `numeric(8,4)` | NULL | 综合评分 |
| `temperature` | `numeric(8,4)` | NULL | 复盘温度参数 |
| `summary_json` | `jsonb` | NOT NULL | 摘要信息 |
| `stats_json` | `jsonb` | NOT NULL DEFAULT `'{}'::jsonb` | 统计指标 |
| `result_object_key` | `text` | NOT NULL | 完整结果 JSON |
| `html_object_key` | `text` | NULL | 导出 HTML |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL | 更新时间 |

建议索引：

- `idx_reviews_user_created_at (user_id, created_at desc)`
- `idx_reviews_match_id (match_id)`
- `idx_reviews_platform_created_at (platform, created_at desc)`
- `idx_reviews_job_id (job_id)`

### 5.4 `review_entries`

用途：

- 记录一份复盘中的逐巡决策项
- 供报告页筛选、分页、错误点定位使用

关键说明：

- 一个 `review` 对应多条 `review_entries`
- 这张表用于列表查询，不替代完整结果 JSON

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 记录 ID |
| `review_id` | `uuid` | FK `reviews(id)` | 所属报告 |
| `seq` | `integer` | NOT NULL | 报告内顺序号 |
| `kyoku_index` | `smallint` | NOT NULL | 局序号 |
| `honba` | `smallint` | NOT NULL DEFAULT `0` | 本场 |
| `junme` | `smallint` | NOT NULL | 巡目 |
| `tiles_left` | `smallint` | NOT NULL | 剩余牌数 |
| `last_actor` | `smallint` | NULL | 上个动作玩家 |
| `tile` | `text` | NULL | 当前相关牌 |
| `decision_type` | `text` | NOT NULL | 决策类型 |
| `actual_action_json` | `jsonb` | NOT NULL | 实际动作 |
| `expected_action_json` | `jsonb` | NOT NULL | 推荐动作 |
| `is_match` | `boolean` | NOT NULL | 是否一致 |
| `deviation_level` | `text` | NOT NULL DEFAULT `'none'` | 偏差级别 |
| `delta_score` | `integer` | NULL | 近似损失或收益差 |
| `shanten` | `smallint` | NULL | 向听数 |
| `at_furiten` | `boolean` | NULL | 是否振听 |
| `details_json` | `jsonb` | NOT NULL DEFAULT `'[]'::jsonb` | 候选动作详情 |
| `state_snapshot_json` | `jsonb` | NULL | 可选局面快照 |
| `tags_json` | `jsonb` | NOT NULL DEFAULT `'[]'::jsonb` | 标签 |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |

建议约束：

- `unique(review_id, seq)`

建议索引：

- `idx_review_entries_review_seq (review_id, seq)`
- `idx_review_entries_review_kyoku (review_id, kyoku_index, junme)`
- `idx_review_entries_review_deviation (review_id, deviation_level)`
- `idx_review_entries_review_decision_type (review_id, decision_type)`

### 5.5 `matches`

用途：

- 记录一场对战的主实体
- 供对战进行页和历史页使用

关键说明：

- 服务端权威状态不直接由前端拼装
- 当前局面快照可放 `last_state_snapshot_json`

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | 对局 ID |
| `user_id` | `uuid` | FK `users(id)` | 发起用户 |
| `status` | `text` | NOT NULL | 对局状态 |
| `source_type` | `text` | NOT NULL DEFAULT `'internal'` | 来源 |
| `match_type` | `text` | NOT NULL | 东风 / 半庄 |
| `rule_config_json` | `jsonb` | NOT NULL | 规则配置 |
| `ai_config_json` | `jsonb` | NOT NULL | AI 配置 |
| `seat_config_json` | `jsonb` | NOT NULL | 四家座位配置 |
| `current_kyoku_index` | `smallint` | NULL | 当前局序 |
| `current_honba` | `smallint` | NULL | 当前本场 |
| `kyotaku` | `smallint` | NOT NULL DEFAULT `0` | 立直棒 |
| `scores_json` | `jsonb` | NOT NULL | 当前分数 |
| `dora_indicators_json` | `jsonb` | NOT NULL DEFAULT `'[]'::jsonb` | 宝牌指示牌 |
| `last_event_seq` | `integer` | NOT NULL DEFAULT `0` | 最后事件序号 |
| `last_state_snapshot_json` | `jsonb` | NULL | 当前快照 |
| `started_at` | `timestamptz` | NULL | 开始时间 |
| `finished_at` | `timestamptz` | NULL | 结束时间 |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL | 更新时间 |

建议索引：

- `idx_matches_user_created_at (user_id, created_at desc)`
- `idx_matches_status_created_at (status, created_at desc)`
- `idx_matches_finished_at (finished_at desc)`

### 5.6 `match_events`

用途：

- 保存服务端权威事件流
- 是内部对局日志的核心事实表

关键说明：

- 每个事件必须按 `seq` 严格递增
- 可直接导出为 `mjai JSONL`

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 事件 ID |
| `match_id` | `uuid` | FK `matches(id)` | 所属对局 |
| `seq` | `integer` | NOT NULL | 序号 |
| `event_type` | `text` | NOT NULL | 事件类型 |
| `kyoku_index` | `smallint` | NULL | 所属局 |
| `honba` | `smallint` | NULL | 本场 |
| `actor` | `smallint` | NULL | 触发玩家 |
| `source` | `text` | NOT NULL DEFAULT `'server'` | `user` / `ai` / `server` |
| `payload_json` | `jsonb` | NOT NULL | 原始事件 |
| `created_at` | `timestamptz` | NOT NULL | 写入时间 |

建议约束：

- `unique(match_id, seq)`

建议索引：

- `idx_match_events_match_seq (match_id, seq)`
- `idx_match_events_match_event_type (match_id, event_type)`
- `idx_match_events_match_actor (match_id, actor)`

### 5.7 `match_results`

用途：

- 保存对局完成后的摘要结果
- 供 `/play/result/:sessionId` 使用

关键说明：

- 一个 `match` 对应一条 `match_result`
- 详细过程从 `match_events` 重建，页面摘要从该表读取

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `match_id` | `uuid` | PK FK `matches(id)` | 对局 ID |
| `user_rank` | `smallint` | NOT NULL | 用户最终名次 |
| `rankings_json` | `jsonb` | NOT NULL | 四家排名 |
| `final_scores_json` | `jsonb` | NOT NULL | 四家终局分数 |
| `score_deltas_json` | `jsonb` | NOT NULL | 四家点差 |
| `stats_json` | `jsonb` | NOT NULL | 对局统计 |
| `highlights_json` | `jsonb` | NOT NULL DEFAULT `'[]'::jsonb` | 关键转折 |
| `training_summary_json` | `jsonb` | NOT NULL DEFAULT `'{}'::jsonb` | 训练总结 |
| `review_job_id` | `uuid` | FK `review_jobs(id)` NULL | 自动复盘任务 |
| `finished_at` | `timestamptz` | NOT NULL | 结算时间 |
| `created_at` | `timestamptz` | NOT NULL | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL | 更新时间 |

建议索引：

- `idx_match_results_review_job_id (review_job_id)`
- `idx_match_results_finished_at (finished_at desc)`

## 6. 建议 SQL DDL

以下 DDL 是“可运行初稿”，重点是帮助后端尽快开始建模，不代表最终冻结版本。

```sql
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text not null,
  avatar_url text,
  locale text not null default 'zh-CN',
  timezone text not null default 'Asia/Shanghai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  status text not null,
  source_type text not null default 'internal',
  match_type text not null,
  rule_config_json jsonb not null,
  ai_config_json jsonb not null,
  seat_config_json jsonb not null,
  current_kyoku_index smallint,
  current_honba smallint,
  kyotaku smallint not null default 0,
  scores_json jsonb not null,
  dora_indicators_json jsonb not null default '[]'::jsonb,
  last_event_seq integer not null default 0,
  last_state_snapshot_json jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_matches_status check (
    status in ('created', 'waiting', 'in_progress', 'finished', 'aborted', 'failed')
  ),
  constraint chk_matches_type check (
    match_type in ('tonpu', 'hanchan')
  )
);

create table review_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  match_id uuid references matches(id),
  status text not null,
  progress smallint not null default 0,
  step text not null default 'created',
  source_type text not null,
  platform text,
  source_payload jsonb not null,
  options_json jsonb not null default '{}'::jsonb,
  target_player_ref text,
  target_actor smallint,
  raw_input_object_key text,
  normalized_mjai_object_key text,
  review_id uuid,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_review_jobs_status check (
    status in ('created', 'parsing', 'queued', 'analyzing', 'completed', 'failed', 'cancelled')
  ),
  constraint chk_review_jobs_progress check (
    progress between 0 and 100
  ),
  constraint chk_review_jobs_source_type check (
    source_type in ('internal_match', 'tenhou_url', 'tenhou_id', 'majsoul_url', 'upload_file', 'inline_json')
  )
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references review_jobs(id),
  user_id uuid not null references users(id),
  match_id uuid references matches(id),
  platform text,
  target_actor smallint not null,
  target_player_label text,
  engine_name text not null,
  engine_version text not null,
  model_tag text,
  lang text not null default 'zh-CN',
  reviewed_decision_count integer not null default 0,
  match_decision_count integer not null default 0,
  high_deviation_count integer not null default 0,
  medium_deviation_count integer not null default 0,
  optimal_count integer not null default 0,
  rating numeric(8,4),
  temperature numeric(8,4),
  summary_json jsonb not null,
  stats_json jsonb not null default '{}'::jsonb,
  result_object_key text not null,
  html_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table review_jobs
  add constraint fk_review_jobs_review_id
  foreign key (review_id) references reviews(id);

create table review_entries (
  id bigserial primary key,
  review_id uuid not null references reviews(id) on delete cascade,
  seq integer not null,
  kyoku_index smallint not null,
  honba smallint not null default 0,
  junme smallint not null,
  tiles_left smallint not null,
  last_actor smallint,
  tile text,
  decision_type text not null,
  actual_action_json jsonb not null,
  expected_action_json jsonb not null,
  is_match boolean not null,
  deviation_level text not null default 'none',
  delta_score integer,
  shanten smallint,
  at_furiten boolean,
  details_json jsonb not null default '[]'::jsonb,
  state_snapshot_json jsonb,
  tags_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_review_entries_review_seq unique (review_id, seq),
  constraint chk_review_entries_deviation check (
    deviation_level in ('none', 'low', 'medium', 'high')
  ),
  constraint chk_review_entries_decision_type check (
    decision_type in ('discard', 'riichi', 'chi', 'pon', 'kan', 'agari', 'ryukyoku', 'pass', 'other')
  )
);

create table match_events (
  id bigserial primary key,
  match_id uuid not null references matches(id) on delete cascade,
  seq integer not null,
  event_type text not null,
  kyoku_index smallint,
  honba smallint,
  actor smallint,
  source text not null default 'server',
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint uq_match_events_match_seq unique (match_id, seq)
);

create table match_results (
  match_id uuid primary key references matches(id) on delete cascade,
  user_rank smallint not null,
  rankings_json jsonb not null,
  final_scores_json jsonb not null,
  score_deltas_json jsonb not null,
  stats_json jsonb not null,
  highlights_json jsonb not null default '[]'::jsonb,
  training_summary_json jsonb not null default '{}'::jsonb,
  review_job_id uuid references review_jobs(id),
  finished_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_matches_user_created_at on matches (user_id, created_at desc);
create index idx_matches_status_created_at on matches (status, created_at desc);
create index idx_matches_finished_at on matches (finished_at desc);

create index idx_review_jobs_user_created_at on review_jobs (user_id, created_at desc);
create index idx_review_jobs_status_created_at on review_jobs (status, created_at desc);
create index idx_review_jobs_match_id on review_jobs (match_id);
create index idx_review_jobs_review_id on review_jobs (review_id);

create index idx_reviews_user_created_at on reviews (user_id, created_at desc);
create index idx_reviews_match_id on reviews (match_id);
create index idx_reviews_platform_created_at on reviews (platform, created_at desc);
create index idx_reviews_job_id on reviews (job_id);

create index idx_review_entries_review_seq on review_entries (review_id, seq);
create index idx_review_entries_review_kyoku on review_entries (review_id, kyoku_index, junme);
create index idx_review_entries_review_deviation on review_entries (review_id, deviation_level);
create index idx_review_entries_review_decision_type on review_entries (review_id, decision_type);

create index idx_match_events_match_seq on match_events (match_id, seq);
create index idx_match_events_match_event_type on match_events (match_id, event_type);
create index idx_match_events_match_actor on match_events (match_id, actor);

create index idx_match_results_review_job_id on match_results (review_job_id);
create index idx_match_results_finished_at on match_results (finished_at desc);
```

## 7. 关键字段与页面映射

### 7.1 `/review/task/:taskId`

主要依赖：

- `review_jobs.id`
- `review_jobs.status`
- `review_jobs.progress`
- `review_jobs.step`
- `review_jobs.error_code`
- `review_jobs.error_message`
- `review_jobs.review_id`

### 7.2 `/review/report/:reportId`

主要依赖：

- `reviews.*`
- `review_entries.*`

### 7.3 `/play/game/:roomId`

主要依赖：

- `matches.*`
- `match_events.*`

### 7.4 `/play/result/:sessionId`

主要依赖：

- `match_results.*`

## 8. 第一阶段不建议建的表

以下表可以等 MVP 跑通再补：

- `mistake_sets`
- `training_sessions`
- `oauth_accounts`
- `review_exports`
- `notifications`
- `audit_logs`

原因：

- 当前会显著增加开发量
- 现有需求可以通过聚合字段和对象存储先完成

## 9. 下一步建议

在这份草案基础上，建议紧接着做：

1. 把字段同步到 `Pydantic` 模型
2. 生成 `Alembic` 初版迁移
3. 用这些字段反推 OpenAPI schema
4. 先实现复盘链路，再实现对战链路
