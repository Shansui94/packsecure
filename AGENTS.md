# Packsecure OS — Agent 指南

面向 Antigravity Agent 的项目说明。维护者单人全栈负责前端、API、数据库脚本与部署。

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

## 业务真理库与数据字典 (必读)

所有业务逻辑、语言规范与数据库结构必须严格遵照以下文档，**重构或修改时严禁擅自删改或遗漏既有规则**：
- 核心业务真理库：[BUSINESS_RULES.md](docs/BUSINESS_RULES.md)（厂区、机台、工时费率、车队容量、额外补贴等）
- 数据结构字典：[DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)（表结构、枚举值、状态机）
- 系统语言与国际化规范：[I18N_GUIDELINES.md](docs/I18N_GUIDELINES.md)（管理层与司机需三语、外籍工人需六语、车间移动端大图标红绿黄高对比度设计、防语言混杂红线）
- WhatsApp 现场排障手册与词典：[WHATSAPP_ISSUE_TRIAGE.md](docs/WHATSAPP_ISSUE_TRIAGE.md)（现场俚语缩写、司机/操作员常见故障矩阵）
- 全页面联动升级与跨模块核查清单：[PAGE_SYNC_CHECKLIST.md](docs/PAGE_SYNC_CHECKLIST.md)（跨页面状态机对齐、历史老数据防误伤、共享计算工具一致性、全系统50页面依赖字典）

## WhatsApp 现场问题与用户排障响应规范

当开发者在对话中提供 WhatsApp 消息、现场报障文字或截图时，Agent 必须遵循【双轨排查输出】：
1. **意图与实体提取**：自动解析马来语/Manglish 缩写（如 `xleh`, `rosak`, `naik barang`），补全车牌（如 `9821` 对应 `VPC 9821` 65卷或 `APH 9821` 92卷）、单号与机台。
2. **规则核验 (SOP Check)**：对照业务真理库核实是用户误解/未依 SOP 还是系统异常。
3. **技术诊断 (For Developer)**：提供对应数据库表名、可直接执行的核查 SQL、关联代码页面及安全处置方案。
4. **回发草稿 (Draft for User)**：生成符合该提报人角色（司机用接地气马来语、管理层用专业中英、操作员用极简步骤）且**不含任何代码/DB黑话**的直接可复制文本。

## 关键安全防线 (Safety Guardrails)

1. **部署前编译自检**：任何前端代码修改完成后，在汇报或建议部署前，必须运行 `npm run build` 或验证 TS 类型，杜绝生产构建报错。
2. **移动端响应式优先**：司机端、操作员端、考勤端必须确保在手机端宽度（375px~390px）下正常显示，弹窗不可遮挡底部导航或操作按钮。
3. **生产数据修改预览**：执行任何批量更新/修复数据的脚本前，必须先查询输出受影响的行数与具体 ID 清单，禁止无条件全量更新。
4. **跨页面联动升级自检 (Cross-Page Sync Audit)**：修改任何核心业务逻辑（物流配送、考勤工时、车间生产、仓储库存、车辆档案）或公共工具时，必须对照 [PAGE_SYNC_CHECKLIST.md](docs/PAGE_SYNC_CHECKLIST.md) 检视所有关联页面，确认各页面状态机一致、历史已结案老单不被误判唤醒，并在最终汇报中输出【跨页面联动升级核验表】。
5. **生产主分支合并与部署 (Production Branch Alignment)**：系统生产环境（Vercel）部署绑定分支为 `origin/main`。功能在本地验证通过后，必须合并推送到 `origin/main`，禁止仅推送到 `test` 分支导致生产环境未生效。

## 常见入口速查

| 需求            | 文件                                              |
| ------------- | ----------------------------------------------- |
| 核心业务规则     | `docs/BUSINESS_RULES.md`                        |
| 数据结构定义     | `docs/DATA_DICTIONARY.md`                       |
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