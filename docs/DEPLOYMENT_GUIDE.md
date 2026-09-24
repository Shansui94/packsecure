# Packsecure OS — 生产部署与发布指南 (Deployment Guide)

Packsecure OS 前端基于 React 19 + TypeScript + Vite 构建，后端 API 采用 Vercel Serverless Functions（`api/` 目录），数据库使用 Supabase。

系统通过根目录的 [vercel.json](vercel.json) 自动完成单页应用（SPA）前端路由回退与 Serverless API 映射。

---

## 一、部署前安全检查 (Safety Checklist)

在触发任何环境部署前，必须严格执行以下三项安全防线：

1. **本地编译自检**：
   ```bash
   npm run build
   ```
   确保 TypeScript 类型检查与 Vite 打包 **0 错误、0 致命警告**。
2. **代码风格与语法校验**：
   ```bash
   npm run lint
   ```
3. **禁止泄漏敏感密钥**：
   - 严禁将包含真实密钥的 `.env` 提交到 Git 仓库。
   - 前端代码只能通过 `import.meta.env.VITE_*` 读取公有变量。

---

## 二、部署方案

### 方案 1：自动化 Git 持续集成（推荐）
1. 将修改推送到 GitHub 主分支（`main`）：
   ```bash
   git add .
   git commit -m "feat: 你的功能描述"
   git push origin main
   ```
2. Vercel 关联仓库后会自动拉取代码、运行 `npm run build` 并完成全球 CDN 与 Serverless 部署。

---

### 方案 2：使用一键脚本或 Vercel CLI 手动发布
若需要在本地快速直接发布至生产环境：

#### 方法 A：运行项目自带脚本
直接在项目根目录下执行 PowerShell 脚本（脚本会自动先执行 `npm run build`，通过后直接部署）：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy_vercel.ps1
```

#### 方法 B：原生 CLI 命令
```bash
# 1. 执行生产打包
npm run build

# 2. 部署至生产环境
npx vercel --prod
```
> 若首次运行，CLI 会提示登录 Vercel 账号并关联至 `packsecure` 项目。

---

## 三、生产环境变量配置 (Vercel Dashboard)

在 Vercel 控制台的项目设置 (**Settings -> Environment Variables**) 中，必须确保已配置以下环境变量：

| 变量名称 | 适用端 | 说明 | 示例 / 格式 |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | 前端 (Browser) | Supabase 项目 API 地址 | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 前端 (Browser) | Supabase 匿名访问公钥 | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 (Serverless) | **禁止带 VITE_ 前缀**，供 `api/` 目录下的管理特权接口使用 | `eyJhbGci...` |
| `GOOGLE_API_KEY` | 服务端 (Serverless) | **禁止带 VITE_ 前缀**，供 Gemini AI 视觉与对话模型使用 | `AIzaSy...` |

---

## 四、常见部署与排错说明

### 1. 刷新页面出现 404 (SPA 路由丢失)
- **原因**：由于系统是单页应用（SPA），非根路径（如 `/staff-status`、`#/production/...`）直接刷新时若未做重定向会导致 404。
- **保障机制**：根目录 [vercel.json](vercel.json) 中已配置捕获规则：
  ```json
  {
      "source": "/(.*)",
      "destination": "/index.html"
  }
  ```
  该配置已自动生效，请确保不要覆盖或删除此规则。

### 2. `/api/*` 请求返回 404 或 500
- 检查 [vercel.json](vercel.json) 中 API 的 `rewrites` 是否正确匹配对应 `api/` 下的 Serverless 函数。
- 查看 Vercel 控制台 **Logs -> Functions** 中的运行堆栈，重点确认 `SUPABASE_SERVICE_ROLE_KEY` 是否已配置。
