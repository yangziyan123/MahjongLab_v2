# 阶段 2 验收报告

## 1. 阶段目标

阶段 2 的目标是把复盘后端 MVP 接到真实 Web 界面上，形成“导入牌谱 -> 查看任务状态 -> 浏览历史报告 -> 查看逐手复盘”的前端闭环。

## 2. 完成了哪些

### 2.1 前端工程落地

已完成：

- 在 `apps/web` 落地阶段 2 前端工程
- 从 `原型设计` 迁移页面骨架、样式和 UI 组件
- 建立 Vite 开发代理，把 `/api` 转发到本地后端
- 建立前端运行说明与忽略规则

对应文件：

- [apps/web/package.json](/d:/Code/MahjongLab/MahjongLab/apps/web/package.json)
- [apps/web/package-lock.json](/d:/Code/MahjongLab/MahjongLab/apps/web/package-lock.json)
- [apps/web/vite.config.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/vite.config.ts)
- [apps/web/.gitignore](/d:/Code/MahjongLab/MahjongLab/apps/web/.gitignore)
- [apps/web/README.md](/d:/Code/MahjongLab/MahjongLab/apps/web/README.md)

### 2.2 前端共享基础层

已完成：

- 建立统一 API Client
- 建立 `TanStack Query` 查询层
- 建立 `Zustand` 复盘页筛选状态
- 建立前后端共享的数据类型
- 建立日期、平台、动作类型等格式化工具

对应文件：

- [apps/web/src/app/lib/api.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/lib/api.ts)
- [apps/web/src/app/lib/types.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/lib/types.ts)
- [apps/web/src/app/lib/query-client.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/lib/query-client.ts)
- [apps/web/src/app/lib/format.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/lib/format.ts)
- [apps/web/src/app/store/review-report.ts](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/store/review-report.ts)

### 2.3 页面迁移与真实数据接入

已完成：

- 首页接入真实摘要与最近复盘
- 复盘导入页接入真实任务创建
- 复盘任务页接入真实轮询与失败重试
- 复盘历史页接入真实列表、筛选和删除
- 复盘报告页接入真实摘要、筛选、时间轴和动作对比
- AI 对战相关页面在本阶段改为明确占位，避免继续展示 mock 业务流

对应文件：

- [apps/web/src/app/App.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/App.tsx)
- [apps/web/src/app/routes.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/routes.tsx)
- [apps/web/src/app/pages/Home.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/Home.tsx)
- [apps/web/src/app/pages/review/ReviewImport.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewImport.tsx)
- [apps/web/src/app/pages/review/ReviewTask.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewTask.tsx)
- [apps/web/src/app/pages/review/ReviewHistory.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewHistory.tsx)
- [apps/web/src/app/pages/review/ReviewReport.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewReport.tsx)
- [apps/web/src/app/pages/play/PlayComingSoon.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/play/PlayComingSoon.tsx)

### 2.4 文档同步

已更新：

- 架构文档，补充阶段 2 已落地前端实现
- 环境文档，补充前端安装、构建和联调方式
- 时间计划文档，补充阶段 2 实施注记

对应文件：

- [docs/ARCHITECTURE_V1.md](/d:/Code/MahjongLab/MahjongLab/docs/ARCHITECTURE_V1.md)
- [docs/ENVIRONMENT_SETUP.md](/d:/Code/MahjongLab/MahjongLab/docs/ENVIRONMENT_SETUP.md)
- [DEVELOPMENT_PLAN_TIMELINE.md](/d:/Code/MahjongLab/MahjongLab/DEVELOPMENT_PLAN_TIMELINE.md)

## 3. 遗留问题

### 3.1 不提供登录页

当前状态：

- 本阶段按你的确认，不实现登录页
- 前端继续按单用户本地模式运行

影响：

- 不阻塞复盘前端 MVP
- 但后续接正式鉴权时，首页和路由守卫还要补一轮

### 3.2 外部牌谱导入尚未开放

当前状态：

- 导入页保留了链接和 ID 的原型入口
- 但后端还未接入 `Tenhou / Majsoul` 外部牌谱适配

影响：

- 当前可演示文件上传和 JSON 导入
- 还不能把外部平台牌谱作为正式入口

### 3.3 对战前端仍是占位页

当前状态：

- `/play/*` 当前统一指向阶段占位页
- 不再继续展示原型中的 mock 对战业务流

影响：

- 首页入口完整
- 但对战功能仍然留待下一阶段

### 3.4 复盘页局面展示仍是调试形态

当前状态：

- 报告页已经有逐手时间轴、动作对比、候选动作和局面信息卡片
- 但“局面展示”仍然用 `state_snapshot` 的原始 JSON 作为阶段 2 调试视图

影响：

- 已足够支撑开发验收和产品演示
- 后续还需要替换成图形化牌桌/牌河展示

### 3.5 人工验收样本数还没到计划值

当前状态：

- 已完成开发侧联调和烟测
- 还没有完成“至少 10 份真实样例由产品视角人工验收”

影响：

- 当前可以进入下一阶段开发
- 但要进入更正式的内测前，仍需补产品侧样例验收

## 4. 验收成果

本阶段已实测通过以下结果：

- `apps/web` 执行 `npm.cmd install` 成功
- `apps/web` 执行 `npm.cmd run build` 成功
- Vite 开发服务器可正常打开：
  - `/`
  - `/review/import`
  - `/review/history`
- 前端开发代理可正常转发 `/api` 到后端
- 通过前端代理口径可创建 `inline_json` 复盘任务
- 通过前端代理口径可轮询任务到 `completed`
- 通过前端代理口径可读取：
  - `GET /api/reviews/{id}`
  - `GET /api/reviews/{id}/entries`

本阶段联调实测得到的典型结果：

- 前端入口页 HTTP 返回 `200`
- `/api/health` 经由前端代理返回 `ok`
- 复盘任务通过前端代理成功进入 `completed`
- 成功取回真实 `review_id`
- 成功取回 `reviewed_decision_count=1`
- 成功取回 `entry_count=1`

## 5. 验收结论

阶段 2 结论：

- `通过（按复盘前端 MVP 口径）`

说明：

- 阶段 2 的核心目标“复盘 Web 可用”已经完成
- 当前已经具备从浏览器演示真实复盘链路的条件
- 登录、外部导入、图形化局面和对战前端仍保留为后续阶段任务

## 6. 下一阶段入口

下一步可进入阶段 3：

- 补 `Tenhou` 导入
- 规划 `Majsoul` 导入方案
- 在复盘结果上增加训练入口和错题沉淀

同时建议并行补一组质量项：

- 10 份以上真实样例的人工验收
- 复盘页图形化局面展示
- 正式鉴权方案预研

## 7. 文档说明

- 本报告不是冻结文档
- 如果阶段 2 的页面范围、联调方式、验收结果或遗留问题发生变化，直接修改本文档
- 后续阶段继续沿用同样格式产出验收报告
