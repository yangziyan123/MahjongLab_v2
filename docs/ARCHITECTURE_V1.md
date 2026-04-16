# MahjongLab 架构设计 V1

## 1. 目标

V1 架构只解决两件事：

- 先把复盘链路做通
- 再把对战链路接到同一套 `mjai` 事件流上

## 2. 架构原则

- 服务端是唯一权威状态
- 平台内部唯一日志标准是 `mjai JSONL`
- 复盘与对战共享同一套核心数据模型
- 原型前端只复用页面骨架，不复用 mock 数据

## 3. 服务划分

```text
apps/
  web

services/
  api
  review-worker
  ai-gateway
  match-service

infra/
  docker
```

### 3.1 `apps/web`

职责：

- 复盘导入、任务、报告、历史
- 首页摘要与入口
- 对战阶段占位页
- 后续阶段再接对战配置、对战中、结果、历史
- 后续阶段再接 WebSocket 实时连接

技术栈：

- Vite
- React
- React Router
- Tailwind CSS
- TanStack Query
- Zustand

阶段 2 已落地实现：

- `apps/web` 已从 `原型设计` 迁移出前端骨架
- 已接通真实 API 的页面：
  - 首页
  - `/review/import`
  - `/review/task/:taskId`
  - `/review/history`
  - `/review/report/:reportId`
- `play` 相关页面当前保留为阶段占位
- 本阶段不提供登录页，按单用户本地模式运行

### 3.2 `services/api`

职责：

- 对外 HTTP API
- 鉴权
- 聚合查询
- 调度 `review-worker`
- 调度 `match-service`

技术栈：

- Python 3.11
- FastAPI
- Pydantic v2
- SQLAlchemy

阶段 1 已落地实现：

- HTTP API 已在 `services/api/app` 落地
- 本地开发默认使用 `SQLite`
- 复盘任务当前由 API 进程内线程池执行
- 已实现 `review-jobs`、`reviews`、`uploads`、`dashboard`、`me` 相关接口

### 3.3 `services/review-worker`

职责：

- 处理 `review_jobs`
- 输入牌谱标准化
- 调用 `Mortal review mode`
- 生成 `reviews` 与 `review_entries`

当前状态：

- 阶段 1 还没有拆出独立 `review-worker` 进程
- 当前先用 `services/api` 内部执行器跑通最小闭环
- 后续接入 Redis / Celery 或独立 worker 服务时，再把这部分职责迁出

### 3.4 `services/ai-gateway`

职责：

- 托管 `Mortal` 常规推理进程
- 给对战服务提供 AI 决策
- 管理长生命周期 worker

### 3.5 `services/match-service`

职责：

- 管理一桌对战生命周期
- 维护服务端权威状态
- 生成 `match_events`
- 对局结束后生成 `match_results`

## 4. 存储划分

目标形态如下；阶段 1 的本地实现见本节最后说明。

### 4.1 PostgreSQL

保存：

- `users`
- `review_jobs`
- `reviews`
- `review_entries`
- `matches`
- `match_events`
- `match_results`

### 4.2 Redis

保存：

- Celery 队列
- 临时会话态
- 实时连接辅助状态

### 4.3 MinIO / S3

保存：

- 原始牌谱上传文件
- 标准化后的 `mjai` 日志
- 完整复盘 JSON
- 导出 HTML / JSON

### 4.4 阶段 1 本地实现

当前代码实现为了先把复盘链路跑通，采用：

- `SQLite`
  - `services/api/data/mahjonglab.db`
- 本地文件系统对象存储
  - `services/api/data/storage/uploads`
  - `services/api/data/storage/reviews`

这不改变目标架构，只是阶段 1 的开发落地形态。

## 5. 核心业务流

### 5.1 复盘流

```text
Web 上传牌谱
  -> API 创建 review_job
  -> review-worker 解析与标准化
  -> Mortal review mode
  -> 写入 reviews / review_entries
  -> Web 轮询或刷新任务状态
  -> 查看复盘报告
```

### 5.2 对战流

```text
Web 创建 match
  -> match-service 建桌
  -> ai-gateway 驱动 AI 回合
  -> 持续写入 match_events
  -> 对局结束生成 match_results
  -> 自动创建 review_job
  -> 进入复盘
```

## 6. 当前已确认的集成边界

- `Mortal` 普通推理可本机运行
- `Mortal review mode` 已可用于阶段 1，本地缺失 `grp` 时按降级路径输出零矩阵 `phi_matrix`
- `原型设计` 前端可构建
- `mjai.app` Python 扩展已构建并可导入
- 阶段 1 后端最小闭环已跑通：
  - `inline_json`
  - `upload_file`
  - `internal_match`

## 7. 结论

V1 架构已经足够开始编码。

后续文档允许调整，但必须保持以下不变：

- `mjai JSONL` 是内部统一日志格式
- 复盘优先于对战
- 每阶段结束都产出验收报告
