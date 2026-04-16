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
  - `inline_json`
  - `tenhou_url`
  - `tenhou_id`
  - `majsoul_file`
- 已实现：
  - `/api/health`
  - `/api/me`
  - `/api/dashboard/summary`
  - `/api/platforms/replay-sources`
  - `/api/uploads`
  - `/api/review-jobs`
  - `/api/review-jobs/{task_id}`
  - `/api/review-jobs/{task_id}/result`
  - `/api/review-jobs/{task_id}/retry`
  - `/api/reviews`
  - `/api/reviews/{review_id}`
  - `/api/reviews/{review_id}/entries`
  - `/api/reviews/{review_id}/mistakes`
  - `/api/mistakes`
  - `DELETE /api/mistakes/{mistake_id}`
  - `DELETE /api/reviews/{review_id}`

## 本地启动

启动前确认：

- `Mortal/mortal/config.toml` 已存在
- `cargo` 可用，且可读取 `mjai-reviewer/Cargo.toml`

```powershell
cd services/api
python -m uvicorn app.main:app --reload
```

服务默认地址：

- `http://127.0.0.1:8000`

## 本地数据目录

运行时会自动创建：

- `services/api/data/mahjonglab.db`
- `services/api/data/storage/sources`
- `services/api/data/storage/normalized`
- `services/api/data/storage/uploads`
- `services/api/data/storage/reviews`

其中 `Tenhou` 导入链路会额外写入：

- `services/api/data/storage/sources/tenhou`
- `services/api/data/storage/normalized/tenhou`

## 已知限制

- `majsoul_url` 仍未实现
- `Tenhou` 下载成功率依赖外部网络和 `tenhou.net` 可达性
- `Majsoul` 当前只支持“导出文件导入”，不支持 URL 直连抓取
