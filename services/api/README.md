# MahjongLab API

阶段 1 的复盘后端 MVP。

## 当前实现范围

- `FastAPI + SQLAlchemy`
- 本地开发默认使用 `SQLite`
- 复盘执行器当前以内嵌线程池运行
- 复盘引擎调用 `Mortal review mode`
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
  - `DELETE /api/reviews/{review_id}`

## 本地启动

```powershell
cd services/api
python -m uvicorn app.main:app --reload
```

服务默认地址：

- `http://127.0.0.1:8000`

## 本地数据目录

运行时会自动创建：

- `services/api/data/mahjonglab.db`
- `services/api/data/storage/uploads`
- `services/api/data/storage/reviews`

## 已知限制

- `tenhou_url`
- `tenhou_id`
- `majsoul_url`

这些来源的适配还没在阶段 1 落地，当前会进入失败态并返回可重试错误。
