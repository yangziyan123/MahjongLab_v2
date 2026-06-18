# MahjongLab API

复盘后端，当前已接通 `Tenhou` 导入 MVP。

## 当前实现范围

- `FastAPI + SQLAlchemy`
- 本地开发默认使用 `SQLite`
- 复盘执行器当前以内嵌线程池运行
- 复盘引擎调用 `Mortal review mode`
- 已支持的牌谱来源：
  - `internal_match`
  - `upload_file`
  - `inline_jsonl`（旧 `inline_json` 任务仍兼容）
  - `tenhou_url`
  - `tenhou_id`
  - `majsoul_file`
  - `majsoul_url`
- 已实现：
  - `/api/health`
  - `/api/me`
  - `/api/play/session`
  - `/api/play/matches/{match_id}`
  - `POST /api/play/matches/{match_id}/review`
  - `/api/play/matches/{match_id}/export`
  - `/api/platforms/replay-sources`
  - `/api/uploads`
  - `/api/review-jobs`
  - `/api/review-jobs/{task_id}`
  - `/api/review-jobs/{task_id}/result`
  - `/api/review-jobs/{task_id}/retry`
  - `/api/reviews`
  - `/api/reviews/{review_id}`
  - `/api/reviews/{review_id}/entries`
  - `/api/reviews/{review_id}/export`
  - `POST /api/reviews/{review_id}/entries/{entry_id}/assistant/conversation`
  - `/api/review-assistant/conversations/{conversation_id}`
  - `POST /api/review-assistant/conversations/{conversation_id}/messages`
  - `POST /api/review-assistant/messages/{message_id}/feedback`
  - `POST /api/review-assistant/messages/{message_id}/regenerate`
  - `DELETE /api/reviews/{review_id}`

## 本地启动

启动前确认：

- `Mortal/mortal/config.toml` 已存在
- `cargo` 可用，且可读取 `mjai-reviewer/Cargo.toml`
- 如需本地打牌功能，使用仓库根目录现有 `.venv` 安装对战依赖：

```powershell
..\..\.venv\Scripts\python.exe -m pip install -e .[play]
```

`Mahjong-AI` 默认读取仓库根目录下的 `Mahjong-AI`。也可以通过环境变量覆盖：

- `MAHJONG_AI_ROOT`
- `MAHJONG_AI_PYTHON`
- `MAHJONG_AI_WEBSOCKIFY`

AI 对战任意小局结算后，对战页和结果页都可以调用 `POST /api/play/matches/{match_id}/review` 创建平台内对局复盘任务。复盘目标座位来自对局开始事件里记录到的真实玩家座位，不再固定使用 0 号位；任务会固定到最近一个 `end_kyoku` 之前的事件数，后续小局继续记录不会污染这次复盘。

```powershell
cd services/api
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

服务默认地址：

- `http://127.0.0.1:8000`

## 测试

在仓库根目录安装开发依赖并运行：

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest services/api/tests -q
```

## 复盘助手配置

服务启动时会自动读取 `services/api/.env`，系统环境变量优先于 `.env`。仓库提供了
`.env.example`，本地 `.env` 已被 Git 忽略，不会提交 API Key。

接入 DeepSeek 时，在 `.env` 中配置：

```dotenv
MAHJONGLAB_REVIEW_ASSISTANT_PROVIDER=deepseek
MAHJONGLAB_REVIEW_ASSISTANT_API_KEY=你的_API_Key
```

DeepSeek 模式默认使用：

- Base URL：`https://api.deepseek.com`
- 模型：`deepseek-v4-flash`
- 思考模式：关闭，以降低逐手解释的延迟和成本

需要更强模型或思考模式时：

```dotenv
MAHJONGLAB_REVIEW_ASSISTANT_MODEL=deepseek-v4-pro
MAHJONGLAB_REVIEW_ASSISTANT_THINKING=true
```

接入其他 OpenAI-compatible 服务时，使用 `openai-compatible` provider，并显式配置 Base URL
和模型名称。

可选配置：

- `MAHJONGLAB_REVIEW_ASSISTANT_BASE_URL`
- `MAHJONGLAB_REVIEW_ASSISTANT_MODEL`
- `MAHJONGLAB_REVIEW_ASSISTANT_THINKING`，默认 `false`
- `MAHJONGLAB_REVIEW_ASSISTANT_TIMEOUT_SECONDS`，默认 `45`
- `MAHJONGLAB_REVIEW_ASSISTANT_MAX_OUTPUT_TOKENS`，默认 `900`

浏览器不会直接接触模型密钥。服务端会先把复盘条目编译成只包含决策时可见信息的
`decision-context.v2`，其中包含稳定证据 ID、确定性牌效、公开安全信息和数据限制。
模型必须返回 `decision-explanation.v1` JSON；服务端校验推荐动作、证据引用、数值来源
和未来信息后才会渲染给用户。模型不可用或输出未通过校验时，自动降级到本地确定性解释。

## 本地数据目录

运行时会自动创建：

- `services/api/data/mahjonglab.db`
- `services/api/data/storage/sources`
- `services/api/data/storage/normalized`
- `services/api/data/storage/uploads`
- `services/api/data/storage/reviews`
- `services/api/data/play_launcher`

其中 `Tenhou` 导入链路会额外写入：

- `services/api/data/storage/sources/tenhou`
- `services/api/data/storage/normalized/tenhou`

## 已知限制

- `Tenhou` 三麻牌谱仍未支持，当前复盘链路只支持四麻
- `Tenhou` 下载成功率依赖外部网络和 `tenhou.net` 可达性
- `Majsoul URL` 需要本机存在已登录雀魂的 Chrome / Edge 配置文件。后端会监听 Unity 客户端的
  `fetchGameRecord` WebSocket 响应，不会读取雀魂账号密码；当前仍需显式传入 `target_player_ref`
