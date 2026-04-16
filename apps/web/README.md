# MahjongLab Web

复盘优先的 Web 前端。

## 当前实现范围

- 首页
- `/review/import`
- `/review/task/:taskId`
- `/review/history`
- `/review/report/:reportId`
- `/training/mistakes`
- `/play/*` 入口页

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
- 已支持 `Tenhou URL / Tenhou ID / 雀魂导出文件 / mjai 文件 / JSON` 导入
- 已支持从复盘报告加入错题库，并在错题库页回跳原报告
- `Majsoul` 当前只支持导出文件导入，不支持 URL 直连
- AI 对战页当前暂不可用
