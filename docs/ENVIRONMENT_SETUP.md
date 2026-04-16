# MahjongLab 环境记录

## 1. 本机实测版本

本次阶段 0 验证环境：

- Python `3.11.7`
- Cargo `1.94.1`
- Node.js `v24.11.1`
- Docker `29.1.3`

## 2. 本地基础服务

阶段 0 提供的本地基础服务定义见：

- [infra/docker/docker-compose.yml](/d:/Code/MahjongLab/MahjongLab/infra/docker/docker-compose.yml)

包含：

- PostgreSQL 16
- Redis 7
- MinIO

启动方式：

```powershell
cd infra\docker
docker compose up -d
```

## 3. 汇聚源码目录状态

说明：

- 当前 `Mortal`、`mjai.app`、`mjai-reviewer`、`原型设计` 已作为源码目录汇聚到主仓中
- 下面记录的是这些目录在当前工作区内的可用性验证结果

### 3.1 `原型设计`

实测结果：

- `npm.cmd install`：成功
- `npm.cmd run build`：成功

说明：

- 原型前端具备作为主项目前端骨架的条件

### 3.2 `Mortal`

实测结果：

- `torch` 可导入
- `libriichi` 可导入
- `mortal/config.toml` 存在
- 配置中 `state_file` 指向真实 `mortal.pth`
- 普通推理 smoke test：成功
- `review mode` 启动 smoke test：成功
- 阶段 1 复盘后端已通过 `Mortal review mode` 生成结构化复盘结果

说明：

- 当前环境缺失 `grp` 文件时，已按阶段 1 的降级路径输出零矩阵 `phi_matrix`
- 这保证了复盘链路可继续开发，但不等于 `grp` 相关能力已经完整恢复

### 3.3 `mjai.app`

实测结果：

- `cargo metadata --format-version 1 --no-deps`：成功
- `python -m pip install .`：成功
- Python 侧 `import mjai`：成功
- `from mjai import Simulator`：成功
- `from mjai.mlibriichi import __version__`：成功
- `from mjai.bot.base import Bot`：成功

已执行命令：

```powershell
cd mjai.app
python -m pip install .
```

结论：

- `mjai.app` 的 Python 扩展已成功构建并安装到当前 Python 环境
- 当前环境中 `mjai.mlibriichi` 问题已解决

### 3.4 `mjai-reviewer`

实测结果：

- `cargo metadata --format-version 1 --no-deps`：成功
- 首次 `cargo check --locked` 在当前会话中超时

说明：

- Cargo manifest 结构正常
- 后续建议在单独构建阶段完成完整编译验证

## 4. 阶段 1 后端开发环境

当前阶段 1 已额外验证：

- `FastAPI`
- `uvicorn`
- `python-multipart`
- `httpx`

已执行命令：

```powershell
python -m pip install fastapi uvicorn python-multipart httpx
```

本地启动方式：

```powershell
cd services\api
python -m uvicorn app.main:app --reload
```

本地运行时会自动生成：

- `services/api/data/mahjonglab.db`
- `services/api/data/storage/uploads`
- `services/api/data/storage/reviews`

## 5. 当前阶段建议

## 5. 阶段 2 前端开发环境

当前阶段 2 已额外验证：

- `npm.cmd install`
- `npm.cmd run build`
- `Vite dev server`
- `/api` 开发代理到后端

已执行命令：

```powershell
cd apps\web
npm.cmd install
npm.cmd run build
```

本地启动方式：

```powershell
cd services\api
python -m uvicorn app.main:app --reload
```

```powershell
cd apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

## 6. 当前阶段建议

当前已经具备继续进入阶段 3 的条件。

仍需优先关注的问题：

1. `Tenhou / Majsoul` 外部牌谱适配尚未接入
2. 独立 `review-worker`、Redis 队列、对象存储还没有从本地 MVP 形态切换到目标架构
3. 前端当前不提供登录页，仍按单用户本地模式运行
4. AI 对战前端仍未开始，当前只提供阶段占位页

## 7. 文档原则

- 本文档不是冻结规范
- 后续只要环境、版本、目录或命令发生变化，直接修改本文档
- 不新增“废弃版本”的环境文档，始终维护单一最新版本
