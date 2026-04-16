# 阶段 0 验收报告

## 1. 阶段目标

阶段 0 的目标是：

- 明确技术路线和主项目边界
- 补齐项目启动所需的核心文档
- 建立主项目目录骨架
- 验证当前环境与上游仓库的可用性
- 为阶段 1 的复盘实现提供明确起点

## 2. 完成了哪些

### 2.1 项目基线与规划

已完成：

- 总体开发计划
- 按时间划分的开发计划
- 原型页面迁移清单
- 数据库表结构初稿
- OpenAPI 草案

对应文件：

- [DEVELOPMENT_PLAN.md](/d:/Code/MahjongLab/MahjongLab/DEVELOPMENT_PLAN.md)
- [DEVELOPMENT_PLAN_TIMELINE.md](/d:/Code/MahjongLab/MahjongLab/DEVELOPMENT_PLAN_TIMELINE.md)
- [PROTOTYPE_PAGE_MIGRATION_CHECKLIST.md](/d:/Code/MahjongLab/MahjongLab/PROTOTYPE_PAGE_MIGRATION_CHECKLIST.md)
- [DATABASE_SCHEMA_DRAFT.md](/d:/Code/MahjongLab/MahjongLab/DATABASE_SCHEMA_DRAFT.md)
- [OPENAPI_DRAFT_V0.yaml](/d:/Code/MahjongLab/MahjongLab/OPENAPI_DRAFT_V0.yaml)

### 2.2 主项目骨架

已完成目录：

- `apps/web`
- `services/api`
- `services/review-worker`
- `services/ai-gateway`
- `services/match-service`
- `infra/docker`
- `docs`
- `docs/acceptance`
- `docs/schemas`

### 2.3 阶段 0 交付文档

已新增：

- [docs/ARCHITECTURE_V1.md](/d:/Code/MahjongLab/MahjongLab/docs/ARCHITECTURE_V1.md)
- [docs/ENVIRONMENT_SETUP.md](/d:/Code/MahjongLab/MahjongLab/docs/ENVIRONMENT_SETUP.md)
- [docs/schemas/review-result.schema.json](/d:/Code/MahjongLab/MahjongLab/docs/schemas/review-result.schema.json)
- [infra/docker/docker-compose.yml](/d:/Code/MahjongLab/MahjongLab/infra/docker/docker-compose.yml)

### 2.4 本机环境验证

实测通过：

- Python `3.11.7`
- Cargo `1.94.1`
- Node.js `v24.11.1`
- Docker `29.1.3`

### 2.5 上游仓库验证

#### `原型设计`

实测完成：

- `npm.cmd install`
- `npm.cmd run build`

结论：

- 前端原型可以作为主项目前端骨架使用

#### `Mortal`

实测完成：

- `torch` 可导入
- `libriichi` 可导入
- `config.toml` 存在
- `state_file` 指向真实权重文件
- 普通推理 smoke test 成功，已得到真实 `dahai` 输出

结论：

- `Mortal` 常规推理链路本机可用

#### `Mortal review mode`

实测完成：

- `MORTAL_REVIEW_MODE=1` 可启动
- 可输出 `none` / `dahai` 等 review mode 下的逐事件输出

结论：

- review mode 已进入可调试状态
- 但完整收尾仍有阻塞

#### `mjai.app`

实测完成：

- `cargo metadata --format-version 1 --no-deps` 成功
- `python -m pip install .` 成功
- Python 侧 `import mjai` 成功
- `from mjai import Simulator` 成功
- `from mjai.mlibriichi import __version__` 成功
- `from mjai.bot.base import Bot` 成功

结论：

- manifest 正常
- Python 扩展已构建完成
- `mjai.app` 已达到可在阶段 1 中使用的状态

#### `mjai-reviewer`

实测完成：

- `cargo metadata --format-version 1 --no-deps` 成功

说明：

- Cargo manifest 正常
- 完整构建验证未在本阶段完成

## 3. 遗留问题

### 3.1 `Mortal review mode` 缺少 `grp` 配置

现象：

- `review mode` 收尾阶段报错：`KeyError: 'grp'`

影响：

- 阶段 1 正式接复盘结果前，需要补齐 `grp` 配置或明确降级策略

### 3.2 `mjai-reviewer` 未完成完整编译验证

现象：

- 本阶段仅完成 metadata 校验，未完成最终二进制验证

影响：

- 不阻塞主项目启动
- 但如果要直接复用其可执行流程，后续需要单独补构建验证

## 4. 验收成果

本阶段已形成以下可直接用于阶段 1 的成果：

- 项目结构已建立
- 前端技术路线已确定
- 复盘优先的实现顺序已冻结
- 数据库与 API 边界已初步定义
- 本机环境已具备正式启动主项目的基础条件
- `Mortal` 普通推理链路已本机验证成功
- `mjai.app` Python 扩展已本机构建并导入成功
- 前端原型已本机构建成功

## 5. 验收结论

阶段 0 结论：

- `通过`

说明：

- 阶段 0 的本质是“建立基线并暴露阻塞项”，不是完成所有上游的最终集成
- 当前已经具备正式进入阶段 1 的条件
- 阶段 1 开始前，需优先处理的明确问题只剩：
  - `Mortal review mode` 的 `grp` 配置问题

## 6. 下一阶段入口

下一步直接进入阶段 1：

- 先把复盘后端 MVP 跑通
- 目标是形成：
  - `POST /api/review-jobs`
  - `GET /api/review-jobs/{id}`
  - `GET /api/reviews/{id}`
  - `GET /api/reviews/{id}/entries`

## 7. 文档说明

- 本报告不是冻结文档
- 后续如果阶段 0 的结论、命令、目录或阻塞项发生变化，直接修改本文件
- 从现在开始，每个阶段结束都必须新增一份对应的验收报告
