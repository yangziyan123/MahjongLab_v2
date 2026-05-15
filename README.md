# MahjongLab

MahjongLab 是一个以麻将复盘为核心的本地 Web 项目。当前主链路由以下模块组成：

- `services/api`：FastAPI 后端，负责牌谱导入、复盘任务、报告与本地数据存储。
- `apps/web`：Vite + React 前端，负责复盘导入、报告查看、错题库和本地对战页面。
- `mjai-reviewer`、`Mortal`、`Mahjong-AI`：复盘与 AI 对战相关的本地引擎/依赖目录。

## 环境要求

建议使用 Windows PowerShell 启动。其他系统可以按同等命令替换路径分隔符和虚拟环境路径。

- Python `3.11+`
- Node.js `20+` 与 npm
- Rust / Cargo：需要本地执行 `mjai-reviewer` 转换或复盘链路时使用

## 安装依赖

在仓库根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install -r requirements.txt
```

<!-- 如果需要使用雀魂 URL 导入能力，还需要安装 Playwright 浏览器：

```powershell
python -m playwright install chromium
``` -->

安装前端依赖：

```powershell
cd apps\web
npm.cmd install
cd ..\..
```

## 可选能力依赖

如果需要本地 AI 对战或更完整的 Mahjong-AI 链路，在基础依赖之外安装后端的 `play` 额外依赖：

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -e "services/api[play]"
```

如果需要运行 `Mahjong-AI` 的训练、数据下载等脚本，可按该子目录自己的依赖文件安装：

```powershell
python -m pip install -r Mahjong-AI\requirements.txt
```

如果需要 Mortal 复盘引擎，请确认：

- `Mortal\mortal\config.toml` 已存在
- `config.toml` 中的模型权重路径有效
- `cargo` 命令可用
- `mjai-reviewer\Cargo.toml` 可读取

`Mortal\mortal\config.example.toml` 可作为配置模板。

## 启动项目

先启动后端。打开一个 PowerShell 窗口，在仓库根目录执行：

```powershell
.\.venv\Scripts\Activate.ps1
cd services\api
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

后端地址：

- `http://127.0.0.1:8000`
- 健康检查：`http://127.0.0.1:8000/api/health`

再启动前端。打开另一个 PowerShell 窗口，在仓库根目录执行：

```powershell
cd apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

访问：

- `http://127.0.0.1:5173`

开发环境下，前端 Vite 已将 `/api` 代理到 `http://127.0.0.1:8000`。

## 可选基础服务

当前本地 MVP 默认用 SQLite，不依赖下面这些服务。若要启动预留的 PostgreSQL、Redis、MinIO：

```powershell
cd infra\docker
docker compose up -d
```

服务端口：

- PostgreSQL：`5432`
- Redis：`6379`
- MinIO API：`9000`
- MinIO Console：`9001`

## 常用检查命令

后端语法检查：

```powershell
.\.venv\Scripts\Activate.ps1
python -m compileall services\api\app
```

前端构建检查：

```powershell
cd apps\web
npm.cmd run build
```

后端健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## 运行时数据

后端启动后会自动创建本地数据目录，主要包括：

- `services/api/data/mahjonglab.db`
- `services/api/data/storage/uploads`
- `services/api/data/storage/normalized`
- `services/api/data/storage/reviews`
- `services/api/data/play_launcher`

这些文件是本地运行产物，已在 `.gitignore` 中忽略。

## 常见问题

如果 PowerShell 禁止激活虚拟环境，可在当前终端临时放开执行策略：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

如果前端请求失败，先确认后端仍在 `127.0.0.1:8000` 运行，再重启前端开发服务器。

如果雀魂 URL 导入失败，确认本机存在可用的 Chrome / Edge 登录会话；必要时配置：

- `MAHJONGLAB_MAJSOUL_BROWSER_EXECUTABLE`
- `MAHJONGLAB_MAJSOUL_BROWSER_USER_DATA_DIR`
- `MAHJONGLAB_MAJSOUL_BROWSER_PROFILE`

如果 AI 对战启动失败，确认 `MAHJONG_AI_ROOT`、`MAHJONG_AI_PYTHON`、`MAHJONG_AI_WEBSOCKIFY` 指向正确位置，默认会使用仓库根目录下的 `Mahjong-AI`。
