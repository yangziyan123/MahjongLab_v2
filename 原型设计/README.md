# 初步设计原型运行说明


## 1. 环境要求

本项目是一个基于 `Vite + React + TypeScript` 的前端原型。

运行前请确认本机已安装:

- `Node.js`
- `npm`

已在以下环境验证通过:

- `Node.js v24.11.1`
- `npm 11.6.2`

如果你的版本和上面不同, 一般也可以运行, 但建议优先使用较新的 LTS 或接近上述版本的环境。

## 2. 进入项目目录

```powershell
cd "原型设计\"
```

## 3. 安装依赖

第一次运行时先安装依赖:

```powershell
npm.cmd install
```

如果你不是在 PowerShell 里运行, 而是在 `cmd`、Git Bash 或 VS Code 的其他终端里运行, 可以直接使用:

```bash
npm install
```

## 4. 启动开发服务器

在项目根目录执行:

```powershell
npm.cmd run dev
```

启动成功后，终端通常会显示一个本地地址，默认一般是:

```text
http://localhost:5173/
```

然后直接在浏览器打开这个地址即可。

## 5. PowerShell 用户特别说明

如果你在 PowerShell 里直接执行:

```powershell
npm run dev
```

有可能遇到类似下面的报错:

```text
npm.ps1 cannot be loaded
```

这不是项目问题，而是 PowerShell 执行策略拦住了 `npm.ps1`。

请使用:

```powershell
npm.cmd install
npm.cmd run dev
```
