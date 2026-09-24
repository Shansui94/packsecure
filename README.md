# Packsecure OS — 现代化工厂与仓储现场运营系统

<p align="center">
  <strong>基于 React 19 + TypeScript + Vite 7 + Tailwind CSS 4 构建的工业级全栈现场运营中台</strong>
</p>

---

## 📌 项目概述

**Packsecure OS** 是一套专为制造与仓储企业现场打造的现代化全栈运营操作系统。系统深度融合了 **MES（制造执行）**、**WMS（仓储管理）**、**TMS（运输与车队）**、**HR（考勤与计薪）**、**IoT 设备直连** 以及 **AI 智能中枢**，实现了从订单下达、原料流转、机台排产、现场质检、仓储出入库、物流装车、司机配送到财务考勤核算的全流程数字化闭环。

---

## 🚀 核心功能模块

### 1. 🏭 生产制造与车间控制 (MES & Shop Floor)
- **生产调度与控制 (Production Control)**：工单排产、机台实时作业状态、排班与产出登记。
- **现场实况监控 (Factory Live OS)**：大屏看板模式，各厂区机台运行状态、产量与异常警报一眼掌控。
- **机台排程与日历 (Machine Schedule)**：机台负载日历视图、换卷与调机计划管理。
- **良率与损耗分析 (Yield Control)**：原纸/塑料原料投料比与成品良率智能计算。
- **机台标签与条码 (Machine Labels)**：一键生成机台与批次二维码/条形码标贴。

### 2. 📦 仓储与库存实时中台 (WMS & Inventory)
- **全局库存中心 (Inventory & LiveStock)**：多厂区（太平 Lama/Corner/Ali、汝来、吉兰丹、柔佛）库存实时同步与预警。
- **库存流转追踪 (Stock Movement)**：入库、调拨、借料、盘点与损耗全链路审计。
- **库位平面图 (Floor Plan)**：基于 Konva 2D 画布的厂区与库位可视化拖拽与堆叠分布图。
- **库存盘点审计 (Stock Audit)**：现场扫码盘点与账实差异校验。

### 3. 🚚 物流配送与车队运营 (TMS & Fleet)
- **送货单智能调度 (Delivery Order Management)**：支持批量调度、排单、签收与异常标记。
- **司机专属移动端 (Driver Delivery Mobile)**：
  - 针对手机端（375px~390px）深度适配的极简操作界面；
  - 配送清单查看、导航对接、到站打卡、现场拍照与电子签收。
- **实时车队看板 (Live Fleet)**：基于 Leaflet 地图的车辆位置流向与送货轨迹可视化。
- **出车准备与车检 (Trip Prep & Lorry Management)**：出车前检查清单、车辆维保与年审追踪。

### 4. 👥 人事、考勤与薪资核算 (HR & Payroll)
- **HR 综合门户 (HR Portal)**：员工档案、工种分配、时薪费率维护。
- **智能打卡与工时拆分**：
  - 严格支持马来西亚时间（MYT, UTC+8）；
  - 精确到分钟的**白班 / 夜班（12:00 AM – 8:00 AM）自动跨班拆分**与差异化费率计算。
- **员工月度结算表 (Personal Monthly Report)**：综合考勤报表、机台工时汇总、额外补贴（津贴/差旅/搬运）与计薪明细导出。
- **请假与假期日历 (Leave Calendar)**：假期申请、审批流与考勤扣减。

### 5. 🤖 AI 智能助理与经营决策 (AI CoPilot)
- **Boss CoPilot / AIAgentWidget**：基于 Google Gemini 模型，支持自然语言查询车间指标、生成运营洞察与异常归因。
- **经营决策看板 (Executive Reports)**：综合营收、各厂区产能对比与交付达成率。
- **审计与日志 (Audit Report & Activity Logs)**：全系统敏感操作与流水完整留痕。

### 6. 🌐 IoT 设备现场模式
- **免密直通模式**：现场固定工业终端通过 URL 哈希路由（`#/production/...`）直达专用生产/称重/扫码界面，免除频繁认证阻碍。

---

## 🛠 技术架构与选型

| 领域 | 核心技术 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite 7 | 顶层 SPA 架构，兼具极致性能与类型安全 |
| **样式与视觉** | Tailwind CSS 4 + Lucide React | 全新 Tailwind v4 引擎，深度响应式适配 |
| **数据与认证** | Supabase (PostgreSQL + Auth + Realtime) | 实时数据订阅、行级权限控制（RLS）与角色矩阵 |
| **本地开发 API** | Express 5 (`server.ts`，端口 8080) | 挂载本地 Serverless 函数与实时调试 |
| **生产端 API** | Vercel Serverless Functions (`api/`) | 轻量弹性后端，无服务器高并发处理 |
| **图形与地图** | Konva / React-Konva + Leaflet | 厂区库位平面图与物流地理轨迹可视化 |
| **硬件与交互** | `@yudiel/react-qr-scanner` + `react-webcam` | 移动端摄像头扫码打卡、送货拍照与质检留证 |
| **报表与导出** | Recharts + SheetJS (XLSX) + jsPDF | 数据图表展现、Excel 导入导出与 PDF 打印排版 |
| **人工智能** | Google Gemini API (`@google/genai`, Vertex AI) | 现场智能助手、文档解析与多模态视觉质检 |

---

## 📁 目录结构

```text
packsecure/
├── src/
│   ├── App.tsx                  # 核心路由分发、认证拦截、IoT 免密模式入口
│   ├── components/              # 通用组件库（Layout 侧边栏、AIAgent 浮窗等）
│   ├── pages/                   # 业务页面（48+ 个核心业务与移动端子页面）
│   │   ├── ProductionControl.tsx# 生产管控中心
│   │   ├── DeliveryOrderManagement.tsx # 配送单中台
│   │   ├── DriverDelivery.tsx   # 司机移动端专属页
│   │   ├── HRPortal.tsx         # HR 人事与薪资看板
│   │   ├── FloorPlan.tsx        # 数字化厂区平面图
│   │   └── ...
│   ├── services/                # Supabase 客户端与外部接口通信服务
│   ├── types/                   # 核心 TypeScript 类型定义（UserRole, JobOrder, etc.）
│   └── utils/                   # 工具类（权限判定、时薪计算、PIN 验证、Logger 等）
├── api/                         # Vercel Serverless API（可与本地 server.ts 共享）
│   ├── agent/                   # Gemini AI 对话、视觉识别与文本解析接口
│   └── lib/                     # 权限鉴权、CORS 与中间件
├── server.ts                    # 本地 Node.js/Express 开发调试服务
├── scripts/                     # 数据库迁移、健康检查、自动化诊断脚本
├── docs/                        # 系统知识库与业务真理库（详见 docs/README.md）
│   ├── README.md                # 文档知识库与全景索引中心
│   ├── BUSINESS_RULES.md        # 核心业务真理库（厂区、机台、工时、时薪费率）
│   ├── DATA_DICTIONARY.md       # 数据库表结构字典与枚举说明
│   ├── GITHUB_WORKFLOW_GUIDE.md # GitHub 协作与高效实战指南
│   ├── DEPLOYMENT_GUIDE.md      # 生产环境部署与发布指南
│   ├── I18N_GUIDELINES.md       # 国际化多语言规范
│   ├── PAGE_SYNC_CHECKLIST.md   # 全页面联动与跨模块自检表
│   ├── SYSTEM_ISSUES.md         # 系统缺陷与巡检看板
│   ├── WHATSAPP_ISSUE_TRIAGE.md # 现场 WhatsApp 排障手册与词典
│   ├── sops/                    # 车间标准化操作规程 (SOP)
│   │   ├── SOP_Driver_Delivery.md
│   │   ├── SOP_HR_Leave_Approval.md
│   │   └── SOP_Machine_Labeling.md
│   └── operations/              # 现场硬件配置与机台清单
│       └── QR_CODES_LIST.md
├── .env.example                 # 环境变量配置模板
└── package.json
```

---

## 💻 快速开始

### 1. 前置环境
- **Node.js**：`>= 20.0.0`
- **包管理器**：`npm`

### 2. 安装依赖
```bash
cd packsecure
npm install
```

### 3. 配置环境变量
复制根目录模板并创建本地 `.env` 文件：
```bash
cp .env.example .env
```
根据实际环境填写 Supabase 与第三方配置：
- 前端只允许读取 `VITE_` 开头的变量（如 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`）。
- 服务端密钥（如 `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY`）**严禁**带有 `VITE_` 前缀，以防泄露至客户端。

### 4. 运行服务

| 场景 | 启动命令 | 说明 |
| :--- | :--- | :--- |
| **推荐：全栈开发模式** | `npm run dev:all` | **并发启动**：本地 API (:8080) + 前端 Vite (:5173)，前端 `/api` 自动代理至后端 |
| **仅启动前端界面** | `npm run dev` | 仅启动 Vite 前端开发服务器（端口 5173） |
| **仅启动后端 API** | `npm run start` | 仅启动 `server.ts` Express 后端服务（端口 8080） |
| **生产打包构建** | `npm run build` | 执行 TypeScript 校验与 Vite 生产级编译优化 |
| **代码静态检查** | `npm run lint` | 执行 ESLint 校验代码规范 |

### 5. 运维与系统自检脚本
```bash
npm run check:health   # 系统健康度一键检查 (DB 连通性、核心表完整性)
npm run check:scan     # 端到端系统诊断扫描
npm run daily-report   # 每日自动化考勤与报表排查
npm run sync:sops      # 一键将 docs/sops/*.md 动态同步至数据库 SOP 中心
```

---

## 📚 系统知识库与文档导航 (Documentation Hub)

系统完整文档已按架构、规范与 SOP 模块化沉淀，全局导航详见 **[docs/README.md](./docs/README.md)**：

- 🏛️ **业务真理与数据**：[`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) (厂区/时薪/工时) · [`docs/DATA_DICTIONARY.md`](./docs/DATA_DICTIONARY.md) (数据字典) · [`docs/I18N_GUIDELINES.md`](./docs/I18N_GUIDELINES.md) (多语言规范)
- 🚀 **工程规范与协同**：[`docs/GITHUB_WORKFLOW_GUIDE.md`](./docs/GITHUB_WORKFLOW_GUIDE.md) (GitHub工作流) · [`docs/DEPLOYMENT_GUIDE.md`](./docs/DEPLOYMENT_GUIDE.md) (部署指南) · [`docs/PAGE_SYNC_CHECKLIST.md`](./docs/PAGE_SYNC_CHECKLIST.md) (联动自检) · [`docs/SYSTEM_ISSUES.md`](./docs/SYSTEM_ISSUES.md) (缺陷追踪)
- 🏭 **现场 SOP 与指导书**：[`docs/sops/SOP_Driver_Delivery.md`](./docs/sops/SOP_Driver_Delivery.md) (司机配送) · [`docs/sops/SOP_HR_Leave_Approval.md`](./docs/sops/SOP_HR_Leave_Approval.md) (HR审批) · [`docs/sops/SOP_Machine_Labeling.md`](./docs/sops/SOP_Machine_Labeling.md) (机台标贴) · [`docs/operations/QR_CODES_LIST.md`](./docs/operations/QR_CODES_LIST.md) (机台二维码)
- 🤖 **AI 与现场排障**：[`AGENTS.md`](./AGENTS.md) (智能体开发规范) · [`docs/WHATSAPP_ISSUE_TRIAGE.md`](./docs/WHATSAPP_ISSUE_TRIAGE.md) (现场群聊排障手册)

---

## 🔐 核心规范与安全底线

1. **业务逻辑真理来源**：
   - 任何涉及厂区代号（T1/N1/K1/J1）、机台编号、时薪规则、加班与补贴的改动，必须严格对照 [`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md)。
   - 数据库操作及字段映射必须遵循 [`docs/DATA_DICTIONARY.md`](./docs/DATA_DICTIONARY.md)。
2. **构建自检防线**：
   - 每次提交或合并前，必须在本地通过 `npm run build` 验证，确保零 TypeScript 类型报错。
3. **移动端优先适配**：
   - 司机端（`DriverDelivery.tsx`）、现场扫码打卡等页面必须在 **375px ~ 390px** 屏幕尺寸下实测通过，弹窗不得遮挡核心操作栏。
4. **安全凭据防泄漏**：
   - 严格禁止在代码或版本库中硬编码敏感 Key；
   - 敏感管理操作必须通过 `api/lib/admin-auth.ts` 的 `requireStaffAuth` 校验员工角色权限。

---

## 📄 开源与版权协议

Packsecure OS 归属内部专用系统，未经许可不得私自拷贝、商业化分发或外传。