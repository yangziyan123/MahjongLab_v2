# MahjongLab Web

阶段 2 的复盘前端 MVP。

## 当前实现范围

- 首页
- `/review/import`
- `/review/task/:taskId`
- `/review/history`
- `/review/report/:reportId`
- `/play/*` 占位页

## 技术栈

- Vite
- React 18
- React Router 7
- Tailwind CSS 4
- TanStack Query
- Zustand

## 本地启动

先启动后端：

```powershell
cd services\api
python -m uvicorn app.main:app --reload
```

再启动前端：

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

打开：

- `http://127.0.0.1:5173`

## 代理配置

开发环境下，Vite 已把 `/api` 代理到：

- `http://127.0.0.1:8000`

## 当前限制

- 不提供登录页
- 仍按单用户本地模式运行
- `Tenhou / Majsoul` 外部牌谱导入尚未开放
- AI 对战页目前仍是阶段占位
