# Packsecure OS — WhatsApp 现场问题与用户反馈排障手册 (WhatsApp Issue Triage SOP)

本文档面向系统维护者（Max Tan）与 AI 助手，专门用于快速消化、排查与回复来自 **WhatsApp 沟通群（司机群、生产群、管理层群、销售群）** 的用户问题。

---

## 一、 WhatsApp 常用语言与马来西亚工商业缩写词典

在马来西亚工厂与物流现场，WhatsApp 信息通常混杂了马来语、英文、华语方言以及大量短信缩写。排查时需首先完成意图转译：

| 原始缩写 / 现场词汇 | 标准马来语 / 英文 | 中文业务含义 | 对应系统模块 / 实体 |
| :--- | :--- | :--- | :--- |
| **`xleh` / `takleh` / `tak bole`** | tidak boleh / cannot | 无法 / 不能操作 | 权限拦截 / 状态机受阻 / 网络问题 |
| **`sangkut`** | tersangkut / stuck | 卡住了 / 页面转圈 | 加载超时 / 死锁 / 未满足校验条件 |
| **`naik barang`** | muat barang / load goods | 装车 / 正在装货 | `trips` 状态 `Loading`，DO 状态 `Loaded` |
| **`dah sampai` / `smpi`** | sudah sampai / arrived | 已送达目的地 | DO 状态 `Delivered` / 签收环节 |
| **`rosak`** | rosak / breakdown | 损坏 / 故障 | 罗里报修 (`LorryService`) / 机台停机 (`Downtime`) |
| **`lori` / `plate`** | lori / vehicle | 罗里 / 车牌 | 默认82卷，`VPC 9821`(65卷), `APH 9821`(92卷) |
| **`xde dlm sistem` / `xda`** | tiada dalam sistem | 系统里找不到 / 没记录 | 订单未排单 (`New`) / 未指派司机 / 厂区过滤不对 |
| **`claim` / `minyak` / `toll`** | claim / fuel / toll | 报销 / 申请补贴 | `claims` / `driver_extra_tasks` |
| **`cuti` / `mc`** | cuti / medical certificate | 请假 / 病假 | `employee_leave` (核验全勤奖资格) |
| **`gaji` / `advance`** | gaji / advance pay | 工资 / 借支预支 | 司机与工人工资核算 / 借支审批 |
| **`roll` / `gulung`** | roll | 卷（气泡膜计量单位） | `live_stock` (单位为 Roll) |
| **`tlg` / `tlg cek`** | tolong / please check | 请帮忙检查 / 紧急协助 | 用户发起排查请求 |
| **`pic` / `gambar`** | picture / photo | 照片 / 凭证 | POD 卸货照 / DO 签收照 / 维修打卡照 |
| **`urgent` / `urgnt`** | urgent | 紧急！马上要送 | 优先排查并确认单据状态 |

---

## 二、 五大高频场景排查速查矩阵

### 1. 司机端问题 (Driver Issues)
- **现象 A: “Lori 9821 takleh loading, tulis terlebih muatan” (装车拦截)**
  - **规则核对**: `VPC 9821` 额定限额为 **65 卷**（标准车为 82 卷，`APH 9821` 为 92 卷）。
  - **排查**: 检查该行程总件数是否超过该车额定容量。
  - **处理**: 确认车牌，若确实超量，需通知调度拆单或换车；若换了大车，在后台调整车辆分配。
- **现象 B: “Dah sampai customer tapi xleh tekan Selesai / Complete” (无法完成签收)**
  - **规则核对**: 系统强制要求**双重凭证**（现场卸货照片 `pod_photo_url` + 客户签字/盖章 DO 照片 `pod_signature_url`）。
  - **排查**: 确认司机是否两张照片都已拍摄并成功上传。
- **现象 C: “Bulan ni kenapa x dapat RM300 bonus?” (全勤奖被扣)**
  - **规则核对**: 全勤奖 RM300 要求出勤率 100%、0 无故旷工。正常经批准的 MC/年假不扣，但未准假缺勤或漏卡会扣除。
  - **排查 SQL**:
    ```sql
    SELECT * FROM employee_leave 
    WHERE user_id = 'DRIVER_UUID' 
      AND start_date >= '2026-09-01' 
      AND status != 'Approved';
    ```

### 2. 车间操作员与扫码端 (Operator & Machine Issues)
- **现象 A: “机台选不到 T1-M03” 或 “扫码提示机台不存在”**
  - **规则核对**: 检查机台是否在对应厂区内。T1-M03 属于太平旧厂 (Taiping / OPM Lama) 缠绕膜机台。
  - **排查 SQL**:
    ```sql
    SELECT machine_id, name, status, current_sku 
    FROM sys_machines_v2 
    WHERE machine_id ILIKE '%T1-M03%';
    ```
- **现象 B: “夜班做工时薪怎么算成白班了？”**
  - **规则核对**: 系统夜班区间为 **12:00 AM – 8:00 AM (MYT)**，白班为 8:00 AM – 12:00 AM。跨时段按 1 分钟精度自动拆分，并非整班按打卡时间一刀切。

### 3. 仓储与销售排单端 (Sales & Logistics Issues)
- **现象 A: “客户催货，单号 DO-AMEER-xxxx 在哪里了？”**
  - **排查 SQL**:
    ```sql
    SELECT s.order_number, s.customer, s.status, s.zone, s.pod_timestamp,
           t.trip_number, t.status as trip_status, u.name as driver_name, u.phone as driver_phone
    FROM sales_orders s
    LEFT JOIN trips t ON s.trip_id = t.id
    LEFT JOIN users_public u ON s.driver_id = u.id
    WHERE s.order_number ILIKE '%DO-AMEER-xxxx%';
    ```
  - **状态说明**:
    - `New`: 待排单
    - `Planned`: 已排入车次 `trip_number`
    - `Loaded`: 已在罗里上
    - `Shipped`: 正在配送途中
    - `Delivered`: 已送达签收（查看 `pod_timestamp` 与凭证照片）

---

## 三、 标准排查流程 (The Triage Pipeline)

```text
[接收 WhatsApp 文本/图片]
       │
       ▼
1. 提炼实体 (车牌、单号、机台、人员、厂区)
       │
       ▼
2. 业务规则初审 (是否符合 BUSINESS_RULES.md 设定？)
       ├─ 是符合规则 (用户误解) ──► 准备通俗解释文案 (带规则与正确做法)
       └─ 否/数据异常 (系统问题) ──► 3. 生成排查 SQL 与修复代码
                                           │
                                           ▼
4. 双轨输出 (技术诊断备忘录 + 直接复制回发 WhatsApp 的多语言文案)
```

---

## 四、 回复话术指南 (WhatsApp Reply Tone)

1. **对司机**:
   - 必须接地气、直截了当、使用简易马来语（Bahasa Melayu）。
   - 严禁说“系统数据库外键约束冲突”；应说：“Abang, sistem detect gambar DO belum upload, tolong snap gambar DO lepas tu tekan submit sekali lagi ya.”
2. **对管理层 (William / Amy / 老板 / 客户)**:
   - 讲求效率与准确数据，提供明确结论与单号状态。
   - 示例：“William 哥，查了 DO-AMEER-260808-001。司机 Ah Seng 今天上午 10:45 已经完成送达并上传签收单，目前进入下一站 Taiping Corner，状态正常。”
3. **对一线外籍工人**:
   - 极简步骤，大白话，必要时附带 1、2、3。
