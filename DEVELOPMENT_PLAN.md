# MahjongLab 项目开发计划

## 1. 项目目标

## 1.1 文档与验收规则

- 每个阶段完成后都要写一份阶段验收报告
- 验收报告至少包含：
  - 完成了哪些
  - 遗留的问题
  - 验收成果
- 项目文档保持灵活修改，不采用“文档冻结”策略
- 如果设计、接口、阶段边界发生变化，直接更新现有文档

### 1.2 产品定位

MahjongLab 的目标不是单纯做一个“能打牌的网站”，而是做一个以训练为核心的日麻平台：

- 支持用户与 AI 实时对局
- 支持对局结束后自动生成复盘结果
- 支持导入外部牌谱并做 AI 复盘
- 支持沉淀“错题库 / 训练集 / 个人改进轨迹”

平台的核心竞争力应当是：

1. 统一的 `mjai` 事件流作为对局与复盘的底层标准
2. 以 `Mortal` 为核心的 AI 对战与分析能力
3. 以“打牌 -> 记录 -> 复盘 -> 提炼训练题”为主线的训练闭环

### 1.3 MVP 范围

第一阶段建议只做以下闭环，不要一开始就把社交、排行榜、商城、复杂匹配全部做进去：

- 用户登录
- 创建 1 人 + 3 AI 对局
- Web 端实时打牌
- 服务端记录完整牌局日志
- 对局结束后自动发起复盘任务
- 复盘页面展示每一巡推荐动作、实际动作、差异说明
- 支持上传外部牌谱进行复盘
- 支持保存复盘结果与历史记录

### 1.4 暂不纳入 MVP 的内容

- PvP 真人对战
- 用户上传自定义 Bot 参赛
- 复杂排位系统
- 移动端原生 App
- 训练营、课程系统、社区内容流
- 大规模赛事和观战系统

这些内容可以在 MVP 跑通后再进入第二阶段。

## 2. 四个参考仓库的复用策略

| 仓库 | 当前定位 | 在 MahjongLab 中的作用 | 建议复用方式 | 注意事项 |
| --- | --- | --- | --- | --- |
| `Mortal` | 日麻 AI 引擎，含 `libriichi` 和 review mode | AI 出牌决策、复盘评估、状态计算能力 | 作为独立 AI Worker / Review Worker 运行；通过标准输入输出或服务封装调用 | `AGPL-3.0-or-later`，且是平台核心依赖 |
| `mjai.app` | `mjai` 协议、模拟器、Bot 基类、Docker 化运行环境 | 作为协议标准、离线模拟器、Bot 验证工具、回归测试工具 | 复用 Python API 和 `mlibriichi`；用于离线仿真和测试，不建议直接作为线上真人对局主服务 | `AGPLv3+`，设计目标偏 Bot 评测，不是为真人实时对局直接设计 |
| `mjai-reviewer` | 牌谱转换、复盘流程、报告渲染参考实现 | 复盘流程参考、Tenhou 转 `mjai`、报告结构参考 | 复用其复盘流程设计和 `convlog`；前端展示建议自己重做，不直接套 HTML 报告 | `Apache-2.0`，但当前实现更偏单机工具和报告生成 |
| `原型设计` | 前端可运行原型，含复盘与对战页面骨架 | 作为前端页面结构、交互流程、视觉样式参考，部分页面可直接迁移 | 优先复用页面骨架、样式 token、UI 组件组织方式；业务数据层重接真实 API | 当前是 `Vite + React Router + Tailwind` 原型，需和主项目脚手架统一 |

### 2.1 结论

- `Mortal` 是平台 AI 核心
- `mjai.app` 是底层协议和离线模拟/验证工具
- `mjai-reviewer` 是复盘流程和日志转换参考实现
- `原型设计` 是前端产品形态和页面骨架参考实现

### 2.2 不建议的做法

- 不要把你自己的业务代码直接写进这些参考仓库
- 不要把 `mjai-reviewer` 直接当成平台后端
- 不要把 `mjai.app` 的 Docker Simulator 直接拿来做线上实时真人桌服务
- 不要把 `原型设计` 原样当生产前端直接上线，必须先替换 mock 数据、补状态管理和接口层

### 2.3 建议的上游管理方式

- 这四个仓库保持只读或最小改动
- 你的主项目单独建仓库，使用 `vendor/`、git submodule 或 git subtree 管理上游
- 所有上游交互都通过 `adapter`/`bridge` 层完成

这样后续同步上游更新才不会失控。

### 2.4 前端原型复用建议

从当前仓库结构看，`原型设计` 已经提供了以下页面骨架：

- 首页
- `review/import`
- `review/task/:taskId`
- `review/report/:reportId`
- `review/history`
- `play/config`
- `play/game/:roomId`
- `play/result/:sessionId`
- `play/history`

建议复用顺序：

1. 先直接复用 `review` 相关页面骨架，优先服务复盘 MVP
2. 再复用 `play/config`、`play/game`、`play/result` 页面骨架，服务对战阶段
3. UI 组件层尽量保留，但数据获取、路由守卫、状态管理、WebSocket、鉴权逻辑重新接入主项目

## 4. 总体技术路线

### 4.1 核心原则

整个平台应围绕一个统一事实来源设计：

- 对局过程统一落盘为 `mjai jsonl`
- AI 出牌与复盘都围绕 `mjai` 事件流工作
- 前端展示消费结构化 JSON，不直接依赖上游 HTML 报告

### 4.2 推荐系统架构

```text
Web Frontend
    |
    v
API Gateway / BFF
    |
    +-- Auth & User Service
    +-- Match Service
    |      |
    |      +-- Game Session Engine
    |      +-- Event Store (mjai jsonl)
    |
    +-- Review Service
    |      |
    |      +-- Review Job Queue
    |      +-- Mortal Review Worker
    |
    +-- Import Service
           |
           +-- Tenhou / Majsoul / Internal Log Adapter

Infra:
- PostgreSQL
- Redis
- Object Storage (S3 / MinIO)
- Observability
```

### 4.3 服务边界建议

#### A. `web`

职责：

- 登录、主页、对局页面、复盘页面
- WebSocket 连接与前端状态展示
- 历史战绩与复盘入口

建议技术：

- Vite + React + TypeScript
- React Router
- Tailwind CSS
- Radix UI / 原型仓库现有 UI 组件
- TanStack Query
- Zustand
- WebSocket

原因：

- 当前已有可运行的 `Vite + React Router` 原型仓库，可显著缩短前端开发时间
- 本项目 MVP 以登录后应用和实时交互为主，不依赖 SEO 和 SSR
- 复用原型页骨架比将其整体迁移到另一套框架成本更低

#### B. `api`

职责：

- 用户认证
- 对局创建 / 查询
- 复盘任务提交 / 查询
- 历史记录 / 用户数据聚合

建议技术：

- FastAPI
- Pydantic
- SQLAlchemy / SQLModel

原因：

- 与 `Mortal`、`mjai.app` 的 Python 生态更容易整合
- 更适合作为编排层

#### C. `match-service`

职责：

- 管理一桌牌局生命周期
- 维护服务端权威状态
- 接收用户动作
- 驱动 AI 座位行动
- 生成完整 `mjai` 日志

关键要求：

- 任何前端 UI 状态都不作为真实状态来源
- 所有动作必须经过服务端合法性校验
- 每一手动作后都能恢复现场，支持断线重连和复盘

#### D. `ai-gateway`

职责：

- 管理 Mortal 进程池或 Worker 池
- 为实时对局提供 AI 决策
- 支持不同 AI 档位 / 策略配置
- 控制超时、重启、健康检查

关键设计：

- 不要每出一张牌就重新启动 `Mortal`
- 采用“长生命周期 Worker + 每桌会话状态”的模式
- 先做单机多进程，后续再升级成独立服务

#### E. `review-service`

职责：

- 接收牌谱
- 统一转换为 `mjai`
- 调用 Mortal review mode
- 生成结构化复盘结果
- 将结果持久化，供前端消费

关键设计：

- 复盘是异步任务，不阻塞主请求
- 复盘结果以 JSON 结构化落库 / 落对象存储
- 前端自己渲染复盘 UI，不直接嵌 `mjai-reviewer` 生成的 HTML

#### F. `import-service`

职责：

- 导入平台内部牌谱
- 导入 Tenhou 牌谱
- 导入 Majsoul 牌谱

建议策略：

- 平台自生成牌谱直接使用 `mjai`
- Tenhou 导入优先复用 `mjai-reviewer/convlog`
- Majsoul 导入单独做 Adapter，不要依赖脆弱的浏览器脚本流程作为长期方案

## 5. 核心数据标准

### 5.1 统一牌谱格式

平台内部标准格式建议定为：

- `mjai jsonl` 或等价的按事件顺序存储的 JSON 数组

原因：

- `Mortal` 能直接消费
- `mjai.app` 生态天然兼容
- 平台内对局和外部导入牌谱都能统一到一个格式

### 5.2 推荐数据模型

至少包含以下核心实体：

- `users`
- `ai_profiles`
- `matches`
- `match_players`
- `match_events`
- `reviews`
- `review_jobs`
- `review_entries`
- `mistake_tags`
- `training_sets`

### 5.3 关键表设计建议

#### `matches`

- `id`
- `user_id`
- `status`
- `source_type`：`internal` / `tenhou` / `majsoul` / `imported`
- `started_at`
- `finished_at`
- `final_scores`
- `rankings`
- `log_uri`

#### `match_events`

- `id`
- `match_id`
- `seq`
- `event_type`
- `payload_json`
- `actor`
- `created_at`

说明：

- 牌局日志建议顺序化存储
- `seq` 必须唯一且连续
- 原始事件完整保留，后续分析字段可单独冗余

#### `reviews`

- `id`
- `match_id`
- `engine`
- `engine_version`
- `status`
- `summary_json`
- `result_uri`
- `created_at`

#### `review_entries`

- `id`
- `review_id`
- `kyoku`
- `honba`
- `junme`
- `tiles_left`
- `actual_action_json`
- `expected_action_json`
- `is_equal`
- `shanten`
- `at_furiten`
- `details_json`

这些字段基本能覆盖 `mjai-reviewer` 当前复盘展示的核心信息。

## 6. API 与实时协议草案

### 6.1 HTTP API

- `POST /api/matches`
- `GET /api/matches/{id}`
- `POST /api/matches/{id}/actions`
- `GET /api/matches/{id}/events`
- `POST /api/reviews`
- `GET /api/reviews/{id}`
- `POST /api/imports/tenhou`
- `POST /api/imports/majsoul`
- `GET /api/history`

### 6.2 WebSocket 频道

- `ws://.../matches/{id}`

消息类型建议：

- `match_started`
- `state_updated`
- `legal_actions`
- `ai_thinking`
- `action_committed`
- `kyoku_finished`
- `match_finished`
- `review_started`
- `review_finished`

### 6.3 前后端职责边界

前端负责：

- 展示当前桌面状态
- 收集用户点击动作
- 管理连接与交互体验

后端负责：

- 判断动作是否可执行
- 维护牌山、手牌、河、副露、立直、流局、和牌等真实状态
- 生成事件日志
- 驱动 AI 与复盘

## 7. 详细开发阶段计划

以下排期默认按 2 到 3 人小团队估算，目标周期 12 到 16 周。若你是单人开发，建议整体乘以 2 到 3。

### Phase 0：预研与立项确认（第 1 周）

目标：

- 把技术与许可证风险全部提前暴露

任务：

- 在目标开发机上完整跑通 `Mortal`
- 跑通 `MORTAL_REVIEW_MODE=1`
- 跑通 `mjai.app` 的 `Simulator`
- 跑通 `mjai-reviewer` 对样例牌谱的复盘
- 产出一条从牌谱输入到复盘 JSON 输出的最小链路
- 确认项目许可证策略
- 确认是否需要 GPU，以及首发并发目标

交付物：

- 技术预研记录
- 本项目主仓库初始化方案
- 环境安装文档
- 架构图 v1

验收标准：

- 能用本机命令完整生成一次 AI 复盘结果
- 已明确 `mjai` 作为内部统一格式
- 已明确 AGPL 是否可接受

### Phase 1：主仓库与基础设施搭建（第 2-3 周）

目标：

- 搭起主项目骨架，形成可持续开发的基础设施

任务：

- 创建主仓库目录结构
- 接入代码规范、Lint、格式化、提交检查
- 搭建本地开发环境：`docker-compose`
- 初始化 PostgreSQL、Redis、MinIO
- 初始化 FastAPI 项目
- 初始化 Vite + React 前端项目
- 评估并接入 `原型设计` 的 UI 组件和页面骨架
- 建立统一配置管理
- 建立日志与监控基线

建议目录：

```text
MahjongLab/
  DEVELOPMENT_PLAN.md
  vendor/
    Mortal/
    mjai.app/
    mjai-reviewer/
  apps/
    web/
  services/
    api/
    match-service/
    ai-gateway/
    review-service/
  packages/
    protocol/
    shared-types/
  infra/
    docker/
  docs/
```

交付物：

- 可启动的本地全套开发环境
- CI 基础流水线
- 统一配置和日志方案
- 前端原型迁移评估结果

验收标准：

- 新开发者 30 分钟内能启动环境
- `web`、`api`、数据库、缓存都能本地运行

### Phase 2：对局引擎 MVP（第 4-6 周）

目标：

- 跑通“用户与 AI 打完一整场”的核心路径

任务：

- 设计对局状态机
- 建立服务端权威状态
- 接入 `Mortal` 决策调用
- 实现 AI 座位流程控制
- 实现用户动作提交与合法性校验
- 为每桌生成完整 `mjai` 日志
- 做断线重连恢复
- 完成基础对局 UI

建议实现策略：

- 服务端维护一桌牌局对象
- 每个动作提交后立即追加一条 `mjai` 事件
- 每局结束自动写入对象存储与数据库摘要
- AI 调用先走进程池，后续再做批量推理优化

交付物：

- 1 人 + 3 AI 可完整打一场
- 每场有完整日志
- 前端能看到实时桌面

验收标准：

- 正常完成一场半庄
- 无人工修补日志
- 刷新页面后仍能恢复当前对局

### Phase 3：复盘引擎 MVP（第 7-9 周）

目标：

- 跑通“打一场 -> 自动复盘 -> 查看结果”

任务：

- 封装 Review Job Queue
- 将内部对局日志直接转入复盘服务
- 调用 `Mortal review mode`
- 参考 `mjai-reviewer` 输出结构定义平台自己的 Review JSON Schema
- 设计复盘页面
- 实现巡目跳转、动作差异、Top 候选动作、局结果展示
- 实现复盘历史页

关键策略：

- 内部牌谱不走 Tenhou 格式中转，直接使用 `mjai`
- `mjai-reviewer` 主要参考它的复盘逻辑和数据结构，不照搬其 HTML

交付物：

- 自动复盘任务
- 复盘详情页
- 复盘摘要页

验收标准：

- 对局结束后可自动生成复盘
- 用户可查看每一巡推荐动作与实际动作差异
- 复盘结果刷新后可重复访问

### Phase 4：外部牌谱导入与训练闭环（第 10-12 周）

目标：

- 把平台从“AI 对战器”升级为“训练平台”

任务：

- 接入 Tenhou 牌谱导入
- 实现 Majsoul 牌谱导入方案
- 增加错题标记、重点局收藏
- 从复盘结果生成训练题
- 增加“只看失误巡目”“只看立直判断”“只看鸣牌判断”等筛选
- 增加 AI 难度 / 风格档位

训练闭环建议：

1. 用户打完或导入牌谱
2. 系统生成复盘
3. 系统标记关键失误点
4. 用户将失误加入训练集
5. 后续进入定向练习模式

交付物：

- 外部牌谱导入
- 错题库
- 基础训练模式

验收标准：

- 外部牌谱可转入统一复盘流程
- 用户能筛选和保存自己的失误点

### Phase 5：质量、性能与 Beta 上线（第 13-16 周）

目标：

- 让系统达到可公开测试的稳定度

任务：

- 压测 AI 并发与复盘并发
- 做超时控制和故障恢复
- 引入缓存与任务限流
- 完善审计日志和错误监控
- 完善用户引导与空态页面
- 部署测试环境和生产环境
- 做数据备份和恢复预案

性能目标建议：

- 实时 AI 动作响应：热启动后 `p95 < 800ms`
- 单场复盘：CPU 模式下控制在可接受范围内；若目标并发较高则配 GPU Worker
- 对局日志写入：每条事件持久化成功率达到生产可接受水平

交付物：

- Beta 环境
- 部署文档
- 运维手册
- 监控告警面板

验收标准：

- 支持内测用户稳定使用
- 常见错误可被自动观测和快速定位

## 8. 各模块详细任务拆分

### 8.1 Web 前端

页面清单：

- 登录页
- 首页 / 仪表盘
- 新建对局页
- 实时对局页
- 对局结算页
- 复盘列表页
- 复盘详情页
- 导入牌谱页
- 个人训练页

关键组件：

- 牌桌视图
- 手牌区 / 河区 / 副露区
- 倒计时与动作栏
- 复盘时间轴
- 推荐动作面板
- 局况摘要卡片

### 8.2 Match Service

任务：

- 桌状态对象设计
- 动作合法性验证
- AI 回合驱动
- 断线重连恢复
- 牌谱事件持久化
- 对局结束后的总结生成

### 8.3 AI Gateway

任务：

- Mortal Worker 封装
- Worker 池管理
- 健康检查
- 超时终止与重启
- 多 AI 档位配置
- 后续支持批量推理

### 8.4 Review Service

任务：

- Review Schema 设计
- 任务队列
- 失败重试
- 结果存储
- 复盘摘要计算
- 错题提取规则

### 8.5 Import Service

任务：

- Tenhou 转换接入
- Majsoul 牌谱解析
- 日志清洗
- 转换失败回显
- 导入历史管理

## 9. 质量保障方案

### 9.1 测试层次

- 单元测试：动作校验、牌谱解析、状态转换、复盘数据格式
- 集成测试：一整场牌局、AI 调用链、复盘任务链
- 端到端测试：用户开局、打牌、结束、复盘查看
- 回归测试：固定牌谱集与预期输出对比

### 9.2 必建回归资产

建议尽快建立：

- 10 场正常平台内部对局样本
- 10 场 Tenhou 样本
- 10 场 Majsoul 样本
- 包含立直、鸣牌、振听、流局、加杠、抢杠等边界场景的样本集

### 9.3 关键测试指标

- 对局能否完整结束
- 日志事件是否连续、可回放
- 复盘结果是否可重复生成
- AI 异常退出后服务是否可恢复
- 导入失败是否有明确错误提示


### 风险 2：Mortal 启动和推理开销较高

应对：

- 使用长生命周期 Worker
- 把实时对局和复盘拆成不同 Worker 类型
- 提前测 CPU 与 GPU 两种部署方式

### 风险 3：Majsoul 牌谱获取方案不稳定

应对：

- 先优先支持平台内部牌谱和 Tenhou 导入
- Majsoul 导入单独做 Adapter，并接受首版能力有限

### 风险 4：上游仓库更新导致接口漂移

应对：

- 上游只读
- 通过 Adapter 层隔离
- 固定版本标签，不追随 `main` 直接升级

### 风险 5：实时桌面与服务端状态不一致

应对：

- 服务端权威状态
- 前端完全基于服务端事件重建界面
- 所有动作带序号和确认机制

## 11. MVP 验收标准

MVP 完成时，应满足以下条件：

- 用户可以创建并完成一场 1v3 AI 半庄
- 所有对局都能生成完整 `mjai` 日志
- 对局结束后能自动触发复盘
- 用户可以查看逐巡推荐动作和实际动作差异
- 用户可以查看历史对局和历史复盘
- 至少支持一种外部牌谱导入
- 系统出现 AI Worker 崩溃时能自动恢复或给出明确错误

## 12. 建议的第一个开发迭代

如果你现在就开始做，建议第一周只做下面这些：

1. 建一个主仓库，不把业务代码塞进上游仓库
2. 写一份环境安装文档，把 `Mortal`、`mjai.app`、`mjai-reviewer` 都跑通
3. 证明三条链路：
   - `Mortal` 能实时输出动作
   - `Mortal review mode` 能输出复盘结果
   - `mjai.app` 能跑完整模拟
4. 确认内部统一牌谱格式是 `mjai`
5. 画出 `web -> api -> match-service -> ai-gateway -> review-service` 的最小接口图

第一周不要急着写漂亮 UI，先把技术闭环打通。

## 13. 最终建议

这个项目最正确的切入方式，不是“先做一个大而全的网站”，而是按下面顺序推进：

1. 先打通 AI 对局最小闭环
2. 再打通自动复盘闭环
3. 再把复盘结果转成训练能力
4. 最后再扩展导入、社交、排行榜和多模式

从你当前目录里的四个仓库看，最佳策略不是重写底层，而是：

- 用 `Mortal` 做 AI 和复盘内核
- 用 `mjai.app` 做协议、仿真与验证底座
- 用 `mjai-reviewer` 提供复盘实现参考和日志转换参考
- 用 `原型设计` 提供前端页面骨架和视觉交互参考

如果你愿意，我下一步可以继续把这份计划拆成：

- 一份更具体的技术架构设计文档
- 一份主仓库目录结构方案
- 一份按周拆解的开发任务清单
- 一份数据库表结构初稿
