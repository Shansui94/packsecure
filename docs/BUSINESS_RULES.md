# Packsecure OS — 核心业务规则与真理字典 (Business Rules & Domain Knowledge)

本文档是 Packsecure OS 的**唯一业务真理来源 (Single Source of Truth)**。任何 Agent 或开发者在进行功能新增、重构或数据变更时，**必须严格遵循本文档所定义的规则，严禁在重构中遗漏任何既有逻辑**。

---

## 1. 厂区与仓库体系 (Factories & Warehouses)

| 厂区代码 / 标识 | 厂区名称 | 业务属性与定位 | 产线与产品限制规则 |
| :--- | :--- | :--- | :--- |
| **OPM Lama** (T1) | 太平旧厂 (Taiping Main) | 核心生产基地 & 仓库 | 气泡膜 (Bubble Wrap) 与 缠绕膜 (Stretch Film) 主力生产/存放地。 |
| **OPM Corner** / **OPM Baru** | 太平新厂 / 角落厂区 | 仓储与辅助加工 | 与 OPM Lama 紧密联动（OPM Corner 即 OPM Baru）。 |
| **OPM Ali** | 太平分厂 | 仓储/流转 | 辅助仓储点。 |
| **SPD** | 太平 SPD 仓 | 仓储/流转 | 北马流转枢纽。 |
| **Nilai** (N1) | 汝来厂 (Central Hub) | 中马核心生产与中转 | 允许生产与存放**所有品类**产品，覆盖雪兰莪、吉隆坡、森美兰、马六甲等中南部市场。 |
| **Kelantan** (K1) | 吉兰丹厂 (East Coast) | 东海岸生产基地 | 覆盖吉兰丹、登嘉楼、彭亨等东海岸市场。 |
| **Johor** (J1) | 柔佛厂 (South Hub) | 南马生产与配送基地 | 覆盖柔佛 (JB/Skudai/Batu Pahat 等) 及新加坡接驳。 |

---

## 2. 机台编号与产线配置 (Machines & Extruder Lines)

### 2.1 太平厂区 (Taiping / OPM Lama)
* **`T1-M03`**：Stretch Film (T1) —— 缠绕膜机台
* **`T2-M01`**：2M Double Layer (T2) —— 2米双层气泡膜机台
* **`T3-M02`**：1M Single Layer (T3) —— 1米单层气泡膜机台
* **`T4-M04`**：Stretch Film (T4) —— 缠绕膜机台
* **`T5-M05`**：Recycle Machine (T5) —— 塑料回收造粒机台

### 2.2 汝来厂区 (Nilai)
* **`N1-M01`**：1M Double Layer (N1) —— 1米双层气泡膜机台
* **`N2-M02`**：1M Single Layer (N2) —— 1米单层气泡膜机台
* **`N3-M03`**：Recycle Machine (N3) —— 塑料回收造粒机台

### 2.3 吉兰丹厂区 (Kelantan)
* **`K1-M01`**：1M Double Layer (K1) —— 1米双层气泡膜机台
* **`K1-M02`**：1M Single Layer (K1) —— 1米单层气泡膜机台

### 2.4 柔佛厂区 (Johor)
* **`J1-M01`**：2M Double Layer (J1) —— 2米双层气泡膜机台
* **`J1-M02`**：1M Single Layer (J1) —— 1米单层气泡膜机台

---

## 3. 考勤与机台时薪计算规则 (Shift Splits & Hourly Rates)

所有工时计算统一基于**马来西亚时间 (MYT, UTC+8)**：

### 3.1 班次划分
* 🌙 **夜班 (Night Shift)**：`12:00 AM – 8:00 AM` (共 8 小时区间)
* ☀️ **白班 (Day Shift)**：`8:00 AM – 12:00 AM` (共 16 小时区间)
* *工时跨班次时，系统按 1 分钟精度自动拆分夜班工时与白班工时。*

### 3.2 机台时薪标准 (默认配置)
| 机台 / 模式 | 白班时薪 (Day Rate) | 夜班时薪 (Night Rate) | 备注 |
| :--- | :--- | :--- | :--- |
| **T1 / T2 / T4** | RM 10.00 / hr | **RM 15.00 / hr** | 核心机台夜班补贴高 |
| **T3** | RM 8.00 / hr | **RM 13.00 / hr** | 1米单层机 |
| **T5 (Recycle)** | RM 10.00 / hr | RM 10.00 / hr | 回收机固定费率 |
| **N1 / N2** | RM 10.00 / hr | **RM 15.00 / hr** | 汝来主力机台 |
| **N3 (Recycle)** | RM 10.00 / hr | RM 10.00 / hr | 回收机固定费率 |
| **FACTORY_MODE_1** (厂级登录模式1) | RM 8.00 / hr | RM 12.00 / hr | 通用工人模式 |
| **FACTORY_MODE_2** (厂级登录模式2) | RM 10.00 / hr | RM 10.00 / hr | 平行费率 |

---

## 4. 车队管理、排单与运费计算 (Logistics & Fleet Rules)

### 4.1 车辆装载限制
* **标准罗里基准容量**：默认 **82 卷气泡膜**（约 36.81 m³ 体积，承重上限 3000 kg）。
* **特殊车辆容量配置**：
  * 车牌 `VPC 9821`：额定容量 **65 卷**（约 29.18 m³）。
  * 车牌 `APH 9821`：额定容量 **92 卷**（约 41.30 m³）。

### 4.2 运费计算公式
```
Trip Earnings = Base Rate + MAX(0, Drops - Max Places) * Extra Rate Per Place
```
* 依据发货起点 (`trip_origin`) 与送达区域 (`zone`) 在 `delivery_rates` 表中匹配基准价与多点补贴。

### 4.3 司机额外任务补贴 (Extra Allowance)
司机在出车送货之外完成的额外任务，拍照提交后需经 Admin / Manager 审核（Approved）方可计入当月工资：
1. 🛍️ **`SHOPEE` (Shopee / Parcel)**：按次/单补贴
2. 🪵 **`AMBIK PALLET` (Angkat Pallet)**：栈板搬运补贴
3. 🔧 **`LORRY SERVICE`**：罗里送保修/保养补贴
4. ↩️ **`RETURN`**：客户退换货处理补贴
5. 🛠️ **`OTHER`**：其他特定临时任务

### 4.4 司机端配送状态机 (Driver SOP)
```mermaid
stateDiagram-v2
    [*] --> Unassigned: 调度中心开单排单
    Unassigned --> Assigned: 分配给司机 (Driver ID)
    Assigned --> InTransit: 司机扫描车上仪表盘 QR 码开工 (绑定卡车)
    InTransit --> DropSubmitted: 抵达客户点，拍摄 DO 照片与货物照片，提交 Drop
    DropSubmitted --> InTransit: 继续送下一个 Drop Point
    DropSubmitted --> Completed: 所有货物送完回厂，在办公室扫描同一卡车 QR 码交单 (Selesai & 自动解绑)
    Completed --> [*]
```
> [!IMPORTANT]
> **严禁在送货中途手动“完成”整趟行程**：行程只有在司机回厂并**再次扫描当前所开卡车的 QR 码**时，才会由系统自动更新为 `Selesai / Delivered` 并释放车辆。

---

## 5. 权限与安全规范 (Auth & Role Permissions)

### 5.1 角色定义 (User Roles)
* `SuperAdmin`：超级管理员，全模块可见，系统底层配置。
* `Admin`：系统管理员，审批、数据维护、财务、全厂运营。
* `Manager`：厂长 / 部门主管，现场任务审核、打卡与库存调配。
* `LogisticsCoordinator`：物流协调员，专职排单、车辆调度、运费核算。
* `HR`：人事管理，考勤报表、请假审批、薪资核算。
* `Finance` / `Sales`：财务对账 / 销售订单录入。
* `Operator`：车间机台操作员，工单记录、温控填报、原料混料拍照。
* `Driver`：卡车司机，移动端任务查看、拍照签收 (POD)、还车扫码。
* `Device`：IoT 自动化采集设备（ESP32 称重/计数等）。

### 5.2 认证与密码规则
* **操作员/司机 PIN 码**：支持输入 **4 位数字 PIN**，后台系统自动向高位补齐为 6 位（如 `1234` 存为 `001234`）。
* **IoT 免密模式**：以 `#/production/` 开头的机台固定终端绕过常规登录。
* **数据安全性**：涉及生产库存扣减、历史订单状态变更，一律禁止静默无条件全量 UPDATE。
