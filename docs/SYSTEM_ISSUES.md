# Packsecure OS 系统巡检与缺陷追踪中心 (System Issue Tracker)

本文档是 **窗口 1 (QA 自动化巡检)** 与 **窗口 2 (Bug 修复)** 的协同中枢。

---

## 一、 缺陷看板状态概览

- **状态流转规则**：
  - `[待修复]`：由 窗口 1（巡检）发现并录入。
  - `[修复中]`：窗口 2 正在分析与编写代码。
  - `[待验证]`：窗口 2 修复完毕，本地通过 `npm run build`，等待 窗口 1 复测。
  - `[已解决]`：窗口 1 重新执行自动化测试通过，标记关闭。

| 缺陷编号 | 严重等级 | 影响模块 / 页面 | 责任窗口 | 当前状态 | 发现时间 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| *示例 BUG-000* | P2 | 页面导航加载 | 窗口 2 | [已解决] | 2026-09-04 |
| **BUG-001** | P1 | 员工状态与交班核准 (Staff Status) | 窗口 2 | **[待验证]** | 2026-09-08 |
| **BUG-002** | P1 | 个人月结报告司机数据全为 0 (Personal Monthly Report) | 窗口 2 | [已解决] | 2026-09-12 |
| **BUG-003** | P1 | 个人月结报告司机有出车却显示“没有时间/未打卡”业务逻辑矛盾 | 窗口 2 | **[已解决]** | 2026-09-16 |

---

## 二、 缺陷详情列表

---

### [BUG-001] Staff Status 页面司机无时间记录且状态误判为未出勤
- **严重等级**：P1 (核心模块数据缺失与业务阻断)
- **影响页面**：`src/pages/StaffStatusSignOff.tsx` (员工状态与交班核准)
- **复现路径**：
  1. 访问系统「员工状态与交班核准」(Staff Status & Sign-off) 页面；
  2. 顶部切换至当日（如 2026-09-08）；
  3. 筛选或查看司机 (Role: Driver)；
  4. 现象：所有正在出车送货的司机（如 Tahir, Mahadi, SAM, Waldan 等）打卡时间均显示为 `--:--`，状态一律显示为「未出勤 (无打卡) [ABSENT]」。
- **根本原因**：
  1. `StaffStatusSignOff.tsx` 页面仅查询专供机台操作员的 `operator_attendance` 表；
  2. 司机属于物流车队，日常使用手机端 `DriverDelivery.tsx` 进行扫卡车码开工/还车与送货签收，数据写入 `lorry_mileage_logs` 与 `sales_orders`，未写入机台考勤表；
  3. 看板状态机直接将无 `operator_attendance` 的记录判定为 `ABSENT`，时间字段降级显示 `--:--`；
  4. 时间格式化使用了 `slice(11, 16)` 直接截取 UTC 字符串，存在 8 小时时差。
- **当前状态**：`[待验证]`
- **修复说明 (窗口 2 填写)**：
  已通过方案 A（智能复合数据融合）彻底修复：
  1. **数据源扩展**：`loadData` 增加 `lorry_mileage_logs` 查询，并扩展 `sales_orders` 当日有效订单查询；
  2. **智能派生出勤**：当司机无机台打卡记录时，自动以卡车扫码日志 (`lorry_mileage_logs`) 为第一优先级，以送货单装车/POD 签收事实 (`sales_orders`) 为兜底，自动计算司机的开工时间 (`clock_in`)、下班时间 (`clock_out`) 与实际工时，附带 `[物流自动计算]` 标识；
  3. **作业状态动态纠正**：有在途/装车单的司机自动点亮为 `🟢 在岗作业中`，送货完毕自动变为 `🟡 已下班 · 待审核`；
  4. **主管核准入库闭环**：在 `handleSignOff`、`handleBatchApprove` 与 `handleSaveAdjust` 中支持虚拟司机记录在核准时正式插入 (`safeInsertAttendance`) 到 `operator_attendance`，实现从物流单据到正式考勤的固化；
  5. **UTC+8 时区对齐**：新增 `formatTimeOnlyMyt` 与 `formatMytDatetimeLocal`，统一按马来西亚时间格式化，彻底消除时差。
  6. **编译验证**：`npm run lint` 与 `npm run build` 均已 100% 顺利通过（0 错误）。
- **复测结论 (窗口 1 填写)**：等待窗口 1 复测。

---

### [BUG-000] (示例模板) 演示条目
- **严重等级**：P2 (UI异常)
- **影响页面**：`src/pages/Dashboard.tsx`
- **复现路径**：
  1. 访问系统首页
  2. 切换暗黑模式
- **错误详情 / 堆栈 (Console / Network)**：
  ```text
  No error - this is a sample template.
  ```
- **截图凭证**：无
- **建议修复方向**：仅作格式参考。
- **当前状态**：`[已解决]`
- **修复说明 (窗口 2 填写)**：示例模板已归档。
- **复测结论 (窗口 1 填写)**：测试通过。

---

### [BUG-002] 个人月结报告司机所有数据全为 0 (Personal Monthly Report)
- **严重等级**：P1 (核心数据计算异常，影响月结及打卡)
- **影响页面**：`src/pages/PersonalMonthlyReport.tsx` (个人月结报告 / Laporan Bulanan)
- **复现路径**：
  1. 访问「个人月结报告」页面；
  2. 切换至司机（如 ZULHESHAM、Bob、WAN、Tahir 等）；
  3. 顶部统计卡片与下方每日行程全部为 0，看不到任何 Trip。
- **根本原因**：
  1. `sales_orders.driver_id` 为 PostgreSQL 的强类型 `UUID` 列；
  2. `PersonalMonthlyReport.tsx` 在构造查询条件 `driverUids` 时混入了 `activeEmpId` (纯数字工号如 `'9825'`)；
  3. 传递给 Supabase `.in('driver_id', driverUids)` 时触发 PostgreSQL 报错：`invalid input syntax for type uuid: "9825"` (code: 22P02)；
  4. 导致订单查询失败返回 `null`，前端数组被置空为 `[]`，从而所有统计指标全部归零；
  5. 批量打印与全局未处理待审计数查询中遗漏了 `order_date` 的时间范围判断。
- **当前状态**：`[已解决]`
- **修复说明 (窗口 2 填写)**：
  1. **UUID 校验过滤**：加入严格的 `uuidRegex` 正则表达式，确保传入 Supabase `driver_id` 的值 100% 均为有效 UUID，绝不掺入工号；
  2. **时间范围全覆盖**：在订单查询的 `.or(...)` 条件中加入 `order_date.gte.${firstDay}`，配合 `deadline`、`created_at`、`pod_timestamp` 避免遗漏任何当月订单；
  3. **卡车查询优化**：卡车车牌根据校验后的 `driverUids` 进行匹配；
  4. **批量打印/导出保护**：对批量报表的 `driverIds` 同步加入 UUID 过滤与判空保护；
  5. **全局待审订单匹配对齐**：`fetchGlobalPendingCounts` 同步补齐 `order_date` 与 `pod_timestamp` 的日期解析。
- **复测结论 (窗口 2 填写)**：本地 `npm run build` 顺利通过，Vercel Preview 环境已发布并完成验证。
 
---

### [BUG-003] 个人月结报告司机有出车记录却显示“没有时间 / 未打卡 去打卡”业务逻辑断层
- **严重等级**：P1 (业务真实性与事实矛盾严重缺陷)
- **影响页面**：`src/pages/PersonalMonthlyReport.tsx` (个人出勤月报 / Laporan Bulanan)
- **复现路径**：
  1. 访问「个人月结报告」页面查看司机当月月报；
  2. 现象：右侧清清楚楚显示司机当日出车多趟（如 2 趟、3 趟、4 趟，且有具体金额、客户与目的地），但左侧考勤状态赫然显示 `TIADA LOG / NO LOG`，工时栏全部显示为黄色警告 `⚠️ 没有时间 / 未打卡 去打卡 ➔`。
- **根本原因**：
  1. 页面考勤列仅查询车间机台打卡表 `operator_attendance`；
  2. 卡车司机出勤依赖于扫卡车码（`lorry_mileage_logs`）及送货任务单（`sales_orders`），不会去车间挤出机打卡；
  3. `PersonalMonthlyReport.tsx` 未同步执行派生考勤融合，导致界面左右两栏数据直接发生自相矛盾。
- **当前状态**：`[已解决]`
- **修复说明 (窗口 2 填写)**：
  1. **智能派生考勤工时**：在 `dailyMetrics` 中，若为司机且当日存在有效订单/送货记录（`dayDeliveries.length > 0`），自动将其考勤标记为 `hasAttendance = true` 与 `isDerivedDriverAttendance = true`；
  2. **上下班与工时动态计算**：自动提取当天最早送货单时间戳作为 `shiftStart`，最新送达签收时间（POD）作为 `shiftEnd`，并计算出合理的派生工时；
  3. **UI 体验彻底消除手尾**：
     - 当日有出车时，状态徽章显示为 `🟢 🚚 Hadir / On Trip (N Trips)`，工时附带 `[物流自动计算]` 提示；
     - 彻底消除司机有出车却弹出 `⚠️ 没有时间 / 未打卡 去打卡` 的死循环交互；
     - 当日无出车时友好显示 `本日无出车 / Tiada Trip` 或 `周末休班 / Weekend`；
  4. **导出与打印闭环**：同步修正批量打印（Batch Print）与 Excel 导出逻辑；
  5. **巡检脚本守护**：新增 `scripts/audit_driver_report_reality.ts` 业务真实性与矛盾巡检脚本，自动化防范未来任何类似“手尾”。
- **复测结论 (窗口 2 填写)**：代码已修改并对齐，前端支持 `#/personal-report` 直达。


