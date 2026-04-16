# 原型页面迁移清单

## 1. 目的

这份清单用于把 `原型设计` 仓库中的页面，迁移到 MahjongLab 主项目中，并明确：

- 每个页面对应的原型源码位置
- 每个页面需要接入的后端接口
- 每个页面的前端开发任务
- 每个页面需要配合完成的后端开发任务
- 每个页面的验收标准

## 2. 适用范围

本清单覆盖以下原型页面：

- `/`
- `/review/import`
- `/review/task/:taskId`
- `/review/report/:reportId`
- `/review/history`
- `/play/config`
- `/play/game/:roomId`
- `/play/result/:sessionId`
- `/play/history`
- `*`

对应原型源码目录：

- `原型设计/src/app/pages`

## 3. 迁移原则

### 3.1 页面复用原则

- 优先复用页面结构、样式、组件组合方式
- 不复用 mock 数据、定时器模拟进度、硬编码跳转
- 所有业务状态改为来自真实 API 或 WebSocket
- 路由参数保留，但实体边界必须明确

### 3.2 实体边界

为了匹配原型页面，后端建议拆成以下实体：

- `review_job`
  - 表示一次复盘任务
  - 供 `/review/task/:taskId` 使用
- `review`
  - 表示最终复盘结果
  - 供 `/review/report/:reportId` 使用
- `match`
  - 表示一场对战
  - 供 `/play/game/:roomId` 使用
- `match_result`
  - 表示对战结果摘要
  - 供 `/play/result/:sessionId` 使用

### 3.3 后端接口命名约定

本文默认使用以下命名：

- `GET /api/...`
- `POST /api/...`
- `DELETE /api/...`
- `WS /ws/...`

如果后续统一改名，清单中的页面-接口映射关系不变。

## 4. 共享开发任务

这些任务不是某一个页面独有，但必须先完成，否则页面迁移会反复返工。

### 4.1 前端共享任务

- [ ] 建立统一 API Client
- [ ] 建立 `TanStack Query` 查询层
- [ ] 建立统一错误处理和 toast 反馈
- [ ] 建立路由守卫和登录态管理
- [ ] 建立上传文件组件封装
- [ ] 建立分页、筛选、URL 参数同步工具
- [ ] 建立 WebSocket 客户端封装
- [ ] 建立实体类型定义：
  - [ ] `ReviewJob`
  - [ ] `Review`
  - [ ] `ReviewEntry`
  - [ ] `Match`
  - [ ] `MatchResult`
  - [ ] `MatchEvent`

### 4.2 后端共享任务

- [ ] 完成用户登录与鉴权
- [ ] 完成 `review_jobs`、`reviews`、`review_entries` 表
- [ ] 完成 `matches`、`match_events`、`match_results` 表
- [ ] 完成对象存储接入，用于保存牌谱和导出文件
- [ ] 完成统一分页、排序、筛选参数规范
- [ ] 完成异步任务队列和任务状态流转
- [ ] 完成 WebSocket 网关

## 5. 页面总表

| 路由 | 原型文件 | 复用级别 | 主要接口 | 优先级 | 所属阶段 |
| --- | --- | --- | --- | --- | --- |
| `/` | `Home.tsx` | 直接迁移骨架 | `GET /api/dashboard/summary` | P2 | 复盘 MVP 后 |
| `/review/import` | `review/ReviewImport.tsx` | 直接迁移骨架 | `POST /api/review-jobs` | P0 | 复盘前端 |
| `/review/task/:taskId` | `review/ReviewTask.tsx` | 部分重写 | `GET /api/review-jobs/{id}` | P0 | 复盘前端 |
| `/review/report/:reportId` | `review/ReviewReport.tsx` | 部分重写 | `GET /api/reviews/{id}` | P0 | 复盘前端 |
| `/review/history` | `review/ReviewHistory.tsx` | 直接迁移骨架 | `GET /api/reviews` | P0 | 复盘前端 |
| `/play/config` | `play/PlayConfig.tsx` | 直接迁移骨架 | `POST /api/matches` | P1 | 对战前端 |
| `/play/game/:roomId` | `play/PlayGame.tsx` | 大幅重写 | `WS /ws/matches/{id}` | P1 | 对战前端 |
| `/play/result/:sessionId` | `play/PlayResult.tsx` | 部分重写 | `GET /api/matches/{id}/result` | P1 | 对战前端 |
| `/play/history` | `play/PlayHistory.tsx` | 直接迁移骨架 | `GET /api/matches` | P1 | 对战前端 |
| `*` | `NotFound.tsx` | 直接迁移 | 无 | P3 | 任意 |

复用级别说明：

- `直接迁移骨架`：保留原型页面结构，替换数据和交互
- `部分重写`：保留部分布局，主要逻辑重做
- `大幅重写`：视觉可参考，但状态和交互必须按真实业务重建

## 6. 页面详细迁移清单

### 6.1 首页 `/`

原型文件：

- `原型设计/src/app/pages/Home.tsx`

页面职责：

- 作为产品入口页
- 展示两条主线入口：
  - AI 复盘
  - AI 对战
- 展示平台摘要信息

#### 对应后端接口

- `GET /api/me`
  - 返回当前用户信息
- `GET /api/dashboard/summary`
  - 返回首页摘要
  - 建议字段：
    - `review_count`
    - `match_count`
    - `mistake_count`
    - `recent_reviews`
    - `recent_matches`

#### 前端开发任务

- [ ] 保留首页 Hero 和两大功能入口
- [ ] 替换静态介绍为真实摘要卡片
- [ ] 补登录态判断
- [ ] 对未登录用户显示引导
- [ ] 对已登录用户显示最近复盘和最近对战入口

#### 后端开发任务

- [ ] 新增 `GET /api/me`
- [ ] 新增 `GET /api/dashboard/summary`
- [ ] 聚合最近复盘、最近对战、错题数

#### 验收标准

- 已登录用户进入首页可看到真实个人摘要
- 首页两个主入口都能正确跳转
- 未登录时不会误进入需要鉴权的页面

### 6.2 复盘导入页 `/review/import`

原型文件：

- `原型设计/src/app/pages/review/ReviewImport.tsx`

页面职责：

- 接收不同来源的牌谱输入
- 配置复盘参数
- 创建复盘任务

#### 对应后端接口

- `POST /api/review-jobs`
  - 创建复盘任务
  - 建议支持：
    - `source_type=link`
    - `source_type=id`
    - `source_type=file`
    - `source_type=json`
- `POST /api/uploads`
  - 文件上传
  - 返回 `file_key`
- `GET /api/platforms/replay-sources`
  - 返回支持的平台和导入方式

建议请求体：

```json
{
  "source_type": "file",
  "platform": "tenhou",
  "file_key": "uploads/xxx.mjlog",
  "player_ref": "2",
  "kyoku_filter": "all",
  "lang": "zh-CN",
  "anonymous": true,
  "output_format": "json"
}
```

#### 前端开发任务

- [ ] 保留四种导入方式 Tab：
  - [ ] 链接
  - [ ] ID
  - [ ] 文件
  - [ ] JSON
- [ ] 将当前表单状态改为真正提交到 `POST /api/review-jobs`
- [ ] 文件上传改为先上传再提交任务
- [ ] 增加表单校验
- [ ] 增加提交中状态
- [ ] 创建成功后跳转到 `/review/task/:taskId`
- [ ] 处理后端返回的导入失败信息

#### 后端开发任务

- [ ] 建立 `review_job` 创建接口
- [ ] 建立文件上传接口
- [ ] 支持 Tenhou 链接/ID 转换
- [ ] 支持内部 `mjai` JSON 直接入队
- [ ] 返回标准任务状态：
  - `created`
  - `parsing`
  - `queued`
  - `analyzing`
  - `completed`
  - `failed`

#### 验收标准

- 四种导入方式至少有三种在 MVP 中可用
- 创建任务后能拿到真实 `taskId`
- 非法输入时会得到明确错误提示
- 文件导入时不会阻塞整个页面

### 6.3 复盘任务页 `/review/task/:taskId`

原型文件：

- `原型设计/src/app/pages/review/ReviewTask.tsx`

页面职责：

- 展示复盘任务状态
- 展示任务进度
- 成功后跳转到复盘报告页
- 失败时展示错误信息

#### 对应后端接口

- `GET /api/review-jobs/{taskId}`
  - 返回任务状态和进度
- `GET /api/review-jobs/{taskId}/result`
  - 若完成，返回 `review_id`
- 可选：`GET /api/review-jobs/{taskId}/events`
  - 用于更细粒度进度流

建议响应字段：

```json
{
  "id": "task_123",
  "status": "analyzing",
  "progress": 62,
  "step": "running_mortal",
  "review_id": null,
  "error_code": null,
  "error_message": null,
  "created_at": "2026-04-14T10:00:00Z"
}
```

#### 前端开发任务

- [ ] 删除 `useEffect` 中的模拟进度逻辑
- [ ] 改为轮询 `GET /api/review-jobs/{taskId}`
- [ ] 任务完成后自动跳转到 `/review/report/:reportId`
- [ ] 任务失败时显示真实失败原因
- [ ] 增加“重新发起”按钮
- [ ] 增加“返回历史记录”按钮

#### 后端开发任务

- [ ] 提供任务状态查询接口
- [ ] 标准化任务错误码
- [ ] 在任务完成时写入 `review_id`
- [ ] 支持任务失败重试

#### 验收标准

- 页面不再使用本地假进度
- 刷新页面后仍能恢复任务状态
- 任务完成时能自动跳到正确报告页
- 失败状态能展示可读错误信息

### 6.4 复盘报告页 `/review/report/:reportId`

原型文件：

- `原型设计/src/app/pages/review/ReviewReport.tsx`

页面职责：

- 展示整份复盘摘要
- 展示逐巡分析结果
- 支持筛选差异手和高偏差点
- 支持导出

#### 对应后端接口

- `GET /api/reviews/{reportId}`
  - 返回复盘摘要
- `GET /api/reviews/{reportId}/entries`
  - 返回逐巡结果
  - 支持参数：
    - `kyoku`
    - `deviation_level`
    - `action_type`
    - `page`
    - `page_size`
- `GET /api/reviews/{reportId}/export?format=json`
- `GET /api/reviews/{reportId}/export?format=html`
- 可选：`POST /api/reviews/{reportId}/mistakes`
  - 将某条复盘记录加入错题库

建议摘要字段：

- `platform`
- `target_player`
- `final_rank`
- `score_delta`
- `engine_name`
- `engine_version`
- `decision_count`
- `high_deviation_count`
- `medium_deviation_count`
- `optimal_count`

#### 前端开发任务

- [ ] 删除页面内 mock `decisions`
- [ ] 接入摘要接口和逐巡列表接口
- [ ] 将筛选条件同步到 URL 查询参数
- [ ] 增加分页或虚拟滚动
- [ ] 增加“只看差异手”“只看高偏差”筛选
- [ ] 接入导出按钮
- [ ] 预留“加入错题库”入口

#### 后端开发任务

- [ ] 返回复盘摘要
- [ ] 返回逐巡明细
- [ ] 支持多维筛选和分页
- [ ] 生成导出文件
- [ ] 为错题库留出写入接口

#### 验收标准

- 报告页能完整显示真实复盘数据
- 切换筛选条件时只重新请求必要数据
- 导出 JSON 可用
- 高偏差项和实际动作差异显示正确

### 6.5 复盘历史页 `/review/history`

原型文件：

- `原型设计/src/app/pages/review/ReviewHistory.tsx`

页面职责：

- 展示用户历史复盘记录
- 支持搜索、筛选、分页
- 支持查看、导出、删除

#### 对应后端接口

- `GET /api/reviews`
  - 支持参数：
    - `q`
    - `platform`
    - `date_range`
    - `page`
    - `page_size`
- `DELETE /api/reviews/{reportId}`
- `GET /api/reviews/{reportId}/export?format=json`
- `GET /api/reviews/{reportId}/export?format=html`

#### 前端开发任务

- [ ] 删除 `mockHistory`
- [ ] 接入列表查询接口
- [ ] 接入搜索、平台筛选、时间筛选
- [ ] 接入分页
- [ ] 删除按钮增加确认弹窗
- [ ] 导出按钮接真实接口
- [ ] 空状态改为与真实数据联动

#### 后端开发任务

- [ ] 返回分页后的复盘列表
- [ ] 支持多条件搜索
- [ ] 支持删除复盘及其关联资源
- [ ] 支持导出链接或流式下载

#### 验收标准

- 历史页可显示真实复盘记录
- 搜索和筛选可组合使用
- 删除后列表能正确刷新
- 空数据和异常状态显示正常

### 6.6 对战配置页 `/play/config`

原型文件：

- `原型设计/src/app/pages/play/PlayConfig.tsx`

页面职责：

- 选择对局模板或自定义规则
- 选择 AI 数量、难度和训练目标
- 创建一场新对局

#### 对应后端接口

- `GET /api/play-templates`
  - 返回可用模板
- `GET /api/ai-profiles`
  - 返回 AI 难度和配置档位
- `POST /api/matches`
  - 创建一场新对局

建议请求体：

```json
{
  "template": "tonpu_standard",
  "rule_config": {
    "match_type": "tonpu",
    "aka_dora": 3,
    "time_limit_sec": 10
  },
  "ai_config": {
    "ai_count": 3,
    "difficulty": "medium",
    "goal": "defense"
  }
}
```

#### 前端开发任务

- [ ] 保留模板模式和自定义模式切换
- [ ] 接入真实模板列表
- [ ] 接入真实 AI 配置列表
- [ ] 表单提交改为 `POST /api/matches`
- [ ] 创建成功后跳转到 `/play/game/:roomId`

#### 后端开发任务

- [ ] 提供模板列表接口
- [ ] 提供 AI 配置接口
- [ ] 创建对局接口
- [ ] 返回新对局 `match_id`

#### 验收标准

- 选择模板或自定义规则都能创建对局
- 创建成功后能跳转到正确房间
- 非法配置会得到明确错误提示

### 6.7 对战进行页 `/play/game/:roomId`

原型文件：

- `原型设计/src/app/pages/play/PlayGame.tsx`

页面职责：

- 实时展示牌桌状态
- 展示手牌、牌河、分数、局况
- 接收用户动作
- 展示 AI 思考和回合变化

#### 对应后端接口

- `GET /api/matches/{matchId}`
  - 获取当前对局快照
- `GET /api/matches/{matchId}/state`
  - 获取规范化状态
- `POST /api/matches/{matchId}/actions`
  - 提交用户动作
- `GET /api/matches/{matchId}/events?after_seq=...`
  - 断线恢复用
- `WS /ws/matches/{matchId}`
  - 实时事件流

WebSocket 事件建议：

- `match_snapshot`
- `state_updated`
- `legal_actions`
- `turn_started`
- `ai_thinking`
- `action_committed`
- `kyoku_finished`
- `match_finished`
- `error`

#### 前端开发任务

- [ ] 删除 mock 玩家、mock 手牌、mock 牌河、mock 倒计时
- [ ] 页面初始化时拉取对局快照
- [ ] 建立 WebSocket 实时订阅
- [ ] 所有动作按钮基于 `legal_actions` 显示
- [ ] 点击手牌后提交真实动作
- [ ] 刷新页面后按快照 + 事件流恢复现场
- [ ] 增加断线重连
- [ ] 增加对局结束后自动跳转结算页

#### 后端开发任务

- [ ] 建立服务端权威状态机
- [ ] 提供当前局快照接口
- [ ] 提供动作提交接口
- [ ] 提供事件增量接口
- [ ] 提供 WebSocket 实时事件广播
- [ ] 完成 AI 回合驱动和超时控制

#### 验收标准

- 页面完全由真实对局状态驱动
- 用户动作必须经过后端校验
- AI 动作能实时反馈到桌面
- 刷新或断线重连后仍能恢复
- 对局结束后能进入结果页

### 6.8 对战结果页 `/play/result/:sessionId`

原型文件：

- `原型设计/src/app/pages/play/PlayResult.tsx`

页面职责：

- 展示最终名次和点数变化
- 展示关键转折和训练总结
- 提供转入复盘入口
- 提供继续训练入口

#### 对应后端接口

- `GET /api/matches/{matchId}/result`
  - 返回结算结果
- `GET /api/matches/{matchId}/highlights`
  - 返回关键转折点
- `GET /api/matches/{matchId}/summary`
  - 返回训练摘要
- `POST /api/matches/{matchId}/review-jobs`
  - 手动触发复盘
- 或使用 `GET /api/review-jobs?match_id=...`
  - 查询自动复盘状态

#### 前端开发任务

- [ ] 删除页面内 mock `results`
- [ ] 删除页面内 mock `keyMoments`
- [ ] 接入真实结算、关键节点、训练总结接口
- [ ] 将“转入复盘”改成：
  - [ ] 若已有复盘任务则跳转任务页
  - [ ] 若没有则创建复盘任务
- [ ] 将“继续训练”改成带上上局配置的 rematch

#### 后端开发任务

- [ ] 返回结算结果
- [ ] 返回关键节点摘要
- [ ] 返回训练总结
- [ ] 支持手动创建复盘任务或返回自动复盘任务
- [ ] 支持 rematch 所需配置回放

#### 验收标准

- 结果页可展示真实排名和得点变化
- 能从结果页进入对应复盘流程
- 能基于上局配置快速再来一局

### 6.9 对战历史页 `/play/history`

原型文件：

- `原型设计/src/app/pages/play/PlayHistory.tsx`

页面职责：

- 展示历史对战记录
- 展示训练统计和训练目标进度
- 支持查看结果、转入复盘、重开一局

#### 对应后端接口

- `GET /api/matches`
  - 支持参数：
    - `q`
    - `match_type`
    - `difficulty`
    - `date_range`
    - `page`
    - `page_size`
- `GET /api/matches/stats`
  - 返回总体统计
- `GET /api/training-goals/progress`
  - 返回训练目标进度
- `POST /api/matches/{matchId}/rematch`
- `GET /api/review-jobs?match_id={matchId}`

#### 前端开发任务

- [ ] 删除 `mockHistory`
- [ ] 接入总体统计卡片
- [ ] 接入训练目标进度模块
- [ ] 接入对局列表、搜索、筛选、分页
- [ ] “查看结果”接真实结果页
- [ ] “转入复盘”接真实复盘任务查询/创建逻辑
- [ ] “再来一局”接 `rematch`

#### 后端开发任务

- [ ] 提供对局列表
- [ ] 提供统计摘要
- [ ] 提供训练目标进度
- [ ] 提供 rematch 接口
- [ ] 提供 match -> review_job 查询能力

#### 验收标准

- 用户可查看真实历史对局
- 统计卡片与列表数据一致
- 能从历史页进入结果页和复盘页
- 能从历史页直接发起 rematch

### 6.10 404 页面 `*`

原型文件：

- `原型设计/src/app/pages/NotFound.tsx`

页面职责：

- 展示错误路由提示

#### 对应后端接口

- 无

#### 前端开发任务

- [ ] 直接迁移
- [ ] 增加返回首页按钮
- [ ] 保持视觉风格统一

#### 后端开发任务

- 无

#### 验收标准

- 所有未知路由都能进入 404 页面

## 7. 建议的实施顺序

按“先复盘、后对战”的原则，建议实际迁移顺序如下：

### 第一批：复盘闭环

1. `/review/import`
2. `/review/task/:taskId`
3. `/review/report/:reportId`
4. `/review/history`

### 第二批：对战闭环

1. `/play/config`
2. `/play/game/:roomId`
3. `/play/result/:sessionId`
4. `/play/history`

### 第三批：补齐入口和收尾

1. `/`
2. `*`

## 8. 最小联调清单

在页面迁移完成后，至少要完成以下联调：

### 复盘链路

- [ ] 从 `/review/import` 成功创建任务
- [ ] `/review/task/:taskId` 能轮询任务状态
- [ ] 任务完成后跳转 `/review/report/:reportId`
- [ ] `/review/history` 能看到新生成的报告

### 对战链路

- [ ] 从 `/play/config` 创建对局
- [ ] `/play/game/:roomId` 能完成一场真实对局
- [ ] 对局结束后进入 `/play/result/:sessionId`
- [ ] `/play/history` 能看到该局记录
- [ ] 结果页或历史页能转入复盘

## 9. 额外说明

当前原型最值得复用的是：

- 页面信息架构
- 表单结构
- 卡片布局
- 对战页的视觉方向

当前原型最不能直接拿来上线的是：

- 所有 mock 数据
- 本地模拟进度
- 本地假跳转
- 对战页的假牌桌状态

真正的迁移难点不在样式，而在这三件事：

1. `review_job` 和 `review` 的实体拆分
2. `match` 和 `match_result` 的状态建模
3. `/play/game/:roomId` 页面的实时事件驱动
