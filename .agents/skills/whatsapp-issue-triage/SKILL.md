---
name: whatsapp-issue-triage
description: >-
  Handles, diagnoses, and triages user-reported bugs, issues, questions, and error screenshots coming from WhatsApp, WeChat, or factory operational chat groups. Use whenever the user pastes a WhatsApp message, driver issue, machine operator feedback, customer delivery inquiry, or asks to investigate a user-reported problem in Packsecure OS.
---

# WhatsApp 现场故障排查与用户问题处理技能 (WhatsApp Issue Triage Skill)

当用户（系统开发者 Max Tan）在对话中粘贴来自 WhatsApp、微信群、短信或现场工人的问题（包括混杂马来语/英文/方言的口语、报错截图描述、单号查询等）时，使用本技能进行结构化排查。

---

## 一、 触发条件 (When to Activate)

当满足以下任意条件时，必须主动启用本技能规范进行分析和输出：
1. 用户输入包含 WhatsApp 风格的聊天记录、截图内容或工人反馈（例如：“司机说...”、“客户问为什么单号...”、“群里有人问...”）。
2. 文本中含有马来西亚工商业俚语或短信缩写（如 `xleh`, `rosak`, `naik barang`, `dah sampai`, `sangkut`, `tlg cek`, `cuti`, `lori 9821`）。
3. 用户明确要求：“帮我看看这个问题”、“使用者丢上来的这个问题怎么回”。

---

## 二、 核心业务真理锚定 (Business Truth Reference)

排障前，**必须严格对照以下既有规则**，严禁在排障中推翻或忽视这些业务真理：
- 核心真理文档：[BUSINESS_RULES.md](file:///c:/Users/User/.gemini/antigravity-ide/scratch/packsecure/docs/BUSINESS_RULES.md)
- 数据结构定义：[DATA_DICTIONARY.md](file:///c:/Users/User/.gemini/antigravity-ide/scratch/packsecure/docs/DATA_DICTIONARY.md)
- 语言与文案规范：[I18N_GUIDELINES.md](file:///c:/Users/User/.gemini/antigravity-ide/scratch/packsecure/docs/I18N_GUIDELINES.md)
- WhatsApp 词典与常见模式：[WHATSAPP_ISSUE_TRIAGE.md](file:///c:/Users/User/.gemini/antigravity-ide/scratch/packsecure/docs/WHATSAPP_ISSUE_TRIAGE.md)

### 快速记忆红线：
1. **车辆装载量**:
   - 默认标准罗里：**82 卷** 气泡膜。
   - `VPC 9821`：特例限额 **65 卷**。
   - `APH 9821`：特例容量 **92 卷**。
2. **司机送达签收 (POD)**:
   - 必须同时具备 **卸货现场双照**（现场卸货照 `pod_photo_url` + 客户签字/盖章单据 `pod_signature_url`），缺少任一张无法点击完成。
3. **考勤与全勤奖 (Full Attendance Bonus)**:
   - 固定 **RM 300.00 / 月**，适用司机与操作员。
   - 要求：当月 0 无故旷工、出勤 100%。正规合规 MC/年假批准后不扣。
4. **工时班次划分 (UTC+8)**:
   - 🌙 **夜班**: 12:00 AM – 8:00 AM (费率通常高出 RM 3~5/hr)。
   - ☀️ **白班**: 8:00 AM – 12:00 AM。
   - 跨时段按 1 分钟自动切分，并非按打卡瞬时时间一刀切。
5. **厂区与机台归属**:
   - 太平: OPM Lama (`T1-M03`, `T2-M01`, `T3-M02`, `T4-M04`, `T5-M05`), OPM Corner, OPM Ali, SPD
   - 汝来: Nilai (`N1-M01`, `N2-M02`, `N3-M03`)
   - 吉兰丹: Kelantan (`K1-M01`, `K1-M02`)
   - 柔佛: Johor (`J1-M01`, `J1-M02`)

---

## 三、 标准执行步骤 (Step-by-Step Procedure)

### Step 1: 语义转译与实体提取
- 将 Manglish/Malay 缩写转译为标准含义（如 `xleh` -> 无法操作；`naik barang` -> 装车）。
- 提取关键实体：
  - 角色 / 提报人（司机 / 操作员 / 调度 / HR / 财务 / 客户）
  - 关联单号（如 `DO-AMEER-xxxx` 或数字）
  - 车牌（若仅给出 4 位数字如 `9821`，核对是 `VPC 9821` 还是 `APH 9821`）
  - 机台号（如 `T1-M03`, `N1-M01`）
  - 涉及厂区与发生时间

### Step 2: 业务规则与数据初审
- 判断该现象是 **“系统正常业务拦截（用户操作不合规/误解）”** 还是 **“系统异常/代码Bug/数据脏数据”**。

### Step 3: 技术定位与排查方案 (面向开发者 Max Tan)
- 明确指出涉及的前端代码组件路径（`src/pages/...`）或后端 API（`api/...`）。
- 给出精准的 Supabase SQL 查询语句，方便开发者一键在控制台验证数据现状。
- 如需修正数据，提供必须包含精准 `WHERE` 条件的 SQL，严防全量误修改。

### Step 4: 拟定 WhatsApp 回复草稿 (面向最终使用者)
- **绝对禁止向使用者输出数据库报错、代码异常或技术黑话**。
- 按提报人身份输出对应语言版本：
  - **司机**: 口语化地道马来语 (Bahasa Melayu) 或极简中英，直接给动作指令。
  - **管理层 / HR / 财务 / 业务**: 专业凝练的中文或中英双语，带精准结论与数据。
  - **外籍工人**: 极简大白话，分步骤（1、2、3）。

---

## 四、 输出模版规范

每次分析必须包含以下结构：

```markdown
### 📌 1. WhatsApp 问题提取与定性
- **提报人与场景**: [如：太平厂司机 / 调度员]
- **提取实体**: [车牌 / 单号 / 机台 / 厂区]
- **问题属性**: [业务规则拦截 / 状态流转受阻 / 数据不一致 / 系统Bug / 新需求]

### 🔍 2. 业务规则核对 (SOP Check)
- [对照 BUSINESS_RULES.md 解释该场景下的标准规则]

### 🛠️ 3. 开发者排障方案 (For Max Tan)
- **关联代码/页面**: `src/pages/...`
- **核对 SQL**:
  ```sql
  SELECT ... FROM ... WHERE ...;
  ```
- **根因与处置建议**: [若是 Bug 提供修复思路；若是数据错误提供安全修正语句]

### 💬 4. 建议回复给 WhatsApp 的消息草稿
- **[版本 A: 中文/管理层]**: 
  > ...
- **[版本 B: 马来语/司机端 (若适用)]**: 
  > ...
```
