# Packsecure OS — Agent 指南

面向 Cursor Agent 的项目说明。维护者单人全栈负责前端、API、数据库脚本与部署。

## 产品概述

Packsecure OS 是工厂/仓储现场运营系统，覆盖生产、库存、配送、司机、HR、IoT 设备、报表等模块。用户通过 Supabase 登录，按角色与 `role_permissions` 控制菜单可见性。

## 技术栈


| 层级     | 技术                                        |
| ------ | ----------------------------------------- |
| 前端     | React 19、TypeScript、Vite 7、Tailwind CSS 4 |
| 数据     | Supabase（Auth + Postgres + Realtime）      |
| 本地 API | Express（`server.ts`，端口 8080）              |
| 生产 API | Vercel Serverless（`api/` 目录）              |
| AI     | Google Gemini（`api/agent/*`）              |
| 部署     | Vercel（`vercel.json` SPA 回退）              |


## 目录结构

```
packsecure/
├── src/
│   ├── App.tsx              # 路由/页面切换、登录态、IoT 模式
│   ├── components/          # 共用 UI（含 Layout、AIAgentWidget）
│   ├── pages/               # 各功能页面
│   ├── services/supabase.ts # 浏览器端 Supabase 客户端
│   ├── types/index.ts       # 核心类型（UserRole、JobOrder 等）
│   └── utils/               # 工具（pinAuth、logger 等）
├── api/                     # Vercel 函数（同时被 server.ts 挂载）
│   ├── lib/                 # admin-auth、cors、pin-auth
│   └── agent/               # chat、vision、parse-text 等
├── server.ts                # 本地开发 API 入口
├── scripts/                 # 运维/迁移/诊断脚本（tsx）
├── .env.example             # 环境变量模板
└── vercel.json
```

## 本地开发

```bash
npm install
cp .env.example .env   # 填写后勿提交
npm run dev:all        # 推荐：API :8080 + 前端 :5173（/api 代理到 8080）
npm run dev            # 仅前端
npm run start          # 仅 API
npm run build          # 生产构建
npm run lint           # ESLint
```

**Node 版本**：>= 20（见 `package.json` engines）

## 环境变量

- 浏览器仅能读取 `VITE_`*（见 `.env.example`）
- `SUPABASE_SERVICE_ROLE_KEY`、`GOOGLE_API_KEY` 仅服务端使用，**禁止**加 `VITE_` 前缀
- 勿在对话或提交中包含 `.env` 真实值

## 认证与权限

- **Supabase Auth**：常规用户登录（`Login.tsx`）
- **IoT 模式**：URL hash 以 `#/production/` 开头时绕过登录（`App.tsx`）
- **PIN**：司机等场景见 `src/utils/pinAuth.ts`、`api/lib/pin-auth.ts`
- **管理 API**：`api/lib/admin-auth.ts` 的 `requireStaffAuth`，Bearer token + `users_public.role`
- **菜单权限**：`Layout.tsx` + `App.tsx` 读 `role_permissions`（见 `src/utils/pageAccess.ts`）；`LogisticsCoordinator` 为物流协调员角色

## 新增功能检查清单

### 新页面

1. 在 `src/pages/` 新建组件
2. 在 `App.tsx` 的 `switch (activePage)` 注册 `case`
3. 在 `Layout.tsx` 导航项中增加入口（含 `page_id` 与权限）
4. 若需 DB 权限，在 Supabase `role_permissions` 表配置

### 新 API

1. 在 `api/` 新建 handler（Vercel 风格 `(req, res)`）
2. 敏感操作使用 `requireStaffAuth` 或现有 auth 工具
3. 本地调试：在 `server.ts` 用 `mountVercelHandler` 挂载路径
4. 生产由 Vercel 自动识别 `api/` 文件路由

### 数据库 / 脚本

1. 脚本放 `scripts/`，用 `tsx` 运行
2. 涉及生产数据前先确认影响范围；优先写可回滚、可 dry-run 的逻辑
3. `scripts/debug_opm_lama*.ts` 多为历史诊断，勿随意复用或批量修改

## 代码风格

- 匹配现有文件风格，不做无关重构
- UI 文案以项目现有中文为主，保持术语一致
- 类型优先放在 `src/types/index.ts` 或页面旁，避免重复定义
- 未要求时不自动 `git commit` / `git push`

## 常见入口速查


| 需求            | 文件                                              |
| ------------- | ----------------------------------------------- |
| 改路由/登录        | `src/App.tsx`                                   |
| 改侧边栏/主题       | `src/components/Layout.tsx`                     |
| 改类型           | `src/types/index.ts`                            |
| 改 Supabase 调用 | 各 `src/pages/`* 或 `src/services/`               |
| AI 对话         | `api/agent/chat.ts`                             |
| HR/司机管理 API   | `api/manage-employee.ts`、`api/create-driver.ts` |
| 活动日志          | `src/utils/logger.ts`                           |


## 验证建议

改 UI：登录对应角色，在目标菜单操作，看浏览器 Console 与 Network。  
改 API：`npm run dev:all` 后 curl 或前端触发，看终端 8080 日志。  
改脚本：先在测试数据或小范围 ID 上跑，再扩大。