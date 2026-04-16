# 阶段 1 验收报告

## 1. 阶段目标

阶段 1 的目标是先把“上传牌谱 / 提交复盘任务 / 后台分析 / 获取结构化复盘结果”的后端最小闭环做出来，为阶段 2 的复盘前端接入提供真实 API。

## 2. 完成了哪些

### 2.1 复盘后端服务骨架

已完成：

- 在 `services/api` 落地阶段 1 后端服务
- 建立 `FastAPI + SQLAlchemy` 项目骨架
- 建立本地开发用 `SQLite` 与本地文件存储目录
- 增加本地运行说明与忽略规则

对应文件：

- [services/api/pyproject.toml](/d:/Code/MahjongLab/MahjongLab/services/api/pyproject.toml)
- [services/api/README.md](/d:/Code/MahjongLab/MahjongLab/services/api/README.md)
- [services/api/.gitignore](/d:/Code/MahjongLab/MahjongLab/services/api/.gitignore)
- [services/api/app/config.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/config.py)
- [services/api/app/database.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/database.py)

### 2.2 数据模型与接口契约落地

已完成：

- 落地 `users`、`matches`、`match_events`、`review_jobs`、`reviews`、`review_entries`
- 落地阶段 1 响应模型与分页模型
- 输出字段名按 API 口径返回，不暴露内部 ORM 字段名

对应文件：

- [services/api/app/models.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/models.py)
- [services/api/app/schemas.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/schemas.py)

### 2.3 复盘执行链路

已完成：

- 支持 `inline_json`
- 支持 `upload_file`
- 支持 `internal_match`
- 封装 `Mortal review mode` 调用
- 生成结构化 `review` 与 `review_entries`
- 完整结果写入本地对象目录
- 任务失败进入 `failed` 状态并记录错误信息
- 支持失败任务重试

对应文件：

- [services/api/app/review_engine.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/review_engine.py)
- [services/api/app/jobs.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/jobs.py)

### 2.4 API 落地

已完成接口：

- `GET /api/health`
- `GET /api/me`
- `GET /api/dashboard/summary`
- `GET /api/platforms/replay-sources`
- `POST /api/uploads`
- `POST /api/review-jobs`
- `GET /api/review-jobs/{task_id}`
- `GET /api/review-jobs/{task_id}/result`
- `POST /api/review-jobs/{task_id}/retry`
- `GET /api/reviews`
- `GET /api/reviews/{review_id}`
- `GET /api/reviews/{review_id}/entries`
- `DELETE /api/reviews/{review_id}`

对应文件：

- [services/api/app/main.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/main.py)

### 2.5 文档同步

已更新：

- 架构文档，补充阶段 1 已落地实现和目标架构的差异
- 环境文档，补充阶段 1 后端运行方式

对应文件：

- [docs/ARCHITECTURE_V1.md](/d:/Code/MahjongLab/MahjongLab/docs/ARCHITECTURE_V1.md)
- [docs/ENVIRONMENT_SETUP.md](/d:/Code/MahjongLab/MahjongLab/docs/ENVIRONMENT_SETUP.md)

## 3. 遗留问题

### 3.1 外部牌谱适配还没接入

当前状态：

- `tenhou_url`
- `tenhou_id`
- `majsoul_url`

还没有进入统一复盘链路，当前会明确失败并返回可重试错误。

影响：

- 阶段 1 已能支撑平台内部日志和上传 `mjai` 文件
- 但还不能把外部平台牌谱作为真实用户入口

### 3.2 独立 `review-worker` 还没有拆出

当前状态：

- 阶段 1 用 API 进程内线程池执行异步任务
- 尚未接入 Redis / Celery 或独立 worker 服务

影响：

- 本地 MVP 可用
- 但还不适合直接视为生产形态

### 3.3 存储还没有切到目标基础设施

当前状态：

- 本地开发使用 `SQLite + 本地文件系统`
- 尚未接通 `PostgreSQL + Redis + MinIO`

影响：

- 阶段 2 可继续基于当前本地环境开发
- 部署前必须迁移到目标架构

### 3.4 用户体系仍是最小单用户实现

当前状态：

- 当前自动创建默认用户 `MahjongLab User`
- 尚未接入正式认证与多用户隔离

影响：

- 足够支撑前端原型接入和本地开发
- 还不能作为正式账户系统

### 3.5 回归测试规模还不够

当前状态：

- 已完成阶段 1 的多链路 smoke test
- 还没有达到原计划中的“至少 20 份样例牌谱回归”

影响：

- 当前验证的是最小闭环和核心 API 行为
- 后续需要补批量样例牌谱回归集

## 4. 验收成果

本阶段已实测通过以下结果：

- 干净状态下，`GET /api/health` 返回 `200`
- `inline_json` 复盘任务可完成，并生成 `review_id`
- `upload_file` 上传后可进入同一复盘链路并完成
- `internal_match` 可从 `match_events` 读取事件并完成复盘
- `GET /api/review-jobs/{task_id}/result` 可返回任务到报告的映射
- `GET /api/reviews/{review_id}` 与 `GET /api/reviews/{review_id}/entries` 可读取结构化结果
- `POST /api/review-jobs/{task_id}/retry` 已验证可重试失败任务
- `DELETE /api/reviews/{review_id}` 已验证可删除报告并返回 `204`

本阶段实测得到的典型结果：

- 任务状态从 `queued -> parsing -> analyzing -> completed`
- 成功任务会生成真实 `model_tag`
- `review_entries` 中包含：
  - `kyoku_index`
  - `honba`
  - `junme`
  - `tiles_left`
  - `actual_action`
  - `expected_action`
  - `details`
  - `shanten`
  - `at_furiten`

## 5. 验收结论

阶段 1 结论：

- `通过（按本地 MVP 口径）`

说明：

- 阶段 1 的核心目标“复盘后端最小闭环”已经落地并实测通过
- 原计划中的外部牌谱适配、独立 worker、目标存储架构和正式认证仍然保留为后续迭代项
- 当前状态已经足够进入阶段 2 的复盘前端接入

## 6. 下一阶段入口

下一步可直接进入阶段 2：

- 基于 `原型设计` 接入真实复盘 API
- 先打通：
  - 复盘上传页
  - 复盘任务页
  - 复盘报告页
  - 复盘历史页

同时建议并行补一条技术债分支：

- `Tenhou -> mjai`
- 批量回归样例
- 独立 `review-worker`

## 7. 文档说明

- 本报告不是冻结文档
- 如果阶段 1 的实现范围、接口、运行方式或遗留问题发生变化，直接修改本文档
- 从现在开始，后续阶段继续沿用同样格式产出验收报告
