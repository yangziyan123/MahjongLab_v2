# MahjongLab Web

复盘优先的 Web 前端。

## 当前实现范围

- 首页
- `/review/import`
- `/review/task/:taskId`
- `/review/history`
- `/review/report/:reportId`
- `/training/mistakes`
- `/play/config`
- `/play/game/:roomId`
- `/play/result/:sessionId`
- `/play/history`

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
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
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
- 已支持 `Tenhou URL / Tenhou ID / 雀魂导出文件 / 雀魂 URL / mjai 文件 / JSON` 导入
- 已支持从复盘报告加入错题库，并在错题库页回跳原报告
- `Majsoul URL` 需要本机浏览器存在已登录雀魂的会话，并且仍需手动指定目标玩家座位
- AI 对战页会通过后端启动根目录下的 `Mahjong-AI`
