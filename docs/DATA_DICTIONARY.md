# Packsecure OS — 数据库与核心数据结构字典 (Data Dictionary)

本文档定义系统核心数据模型、枚举值定义与字段流转规则。

---

## 1. 核心表结构速查

### 1.1 `trips` / `logistics_trips` (运输车次表)
* `trip_id` / `id`: UUID 主键
* `trip_number`: 车次编号（如 `TRIP-20260828-001`）
* `driver_id`: 关联绑定的司机 User ID
* `vehicle_id`: 关联绑定的罗里 ID / 车牌
* `trip_origin`: 出发工厂/仓库（`TAIPING` / `NILAI` / `KELANTAN` / `JOHOR`）
* `zone`: 目的地主区域（如 `Central_Left`, `Johor_South`, `Penang_North`）
* `status`: 状态枚举
  * `Planning`: 调度规划中
  * `Loading`: 正在备货/装车 (Naik Barang)
  * `En-Route` / `In-Transit`: 途中派送中
  * `Completed` / `Selesai`: 司机回厂扫码还车，行程已结束
* `total_distance_km`: 总里程 (km)
* `trip_drop_count`: 经停卸货点数量

### 1.2 `sales_orders` (销售与配送单据表)
* `id`: UUID 主键
* `order_number`: 订单编号（如 `DO-AMEER-260808-001`）
* `customer`: 客户名称
* `delivery_address`: 送货地址
* `zone`: 送货区域（由算法依据地址自动匹配）
* `driver_id`: 指派司机
* `trip_id`: 所属车次 ID
* `stop_sequence` / `trip_sequence`: 送货经停次序 (1, 2, 3...)
* `status`:
  * `New` / `Pending`: 待排单
  * `Planned`: 已规划入车次
  * `Loaded` (Naik Barang): 已装车
  * `Shipped` / `In-Transit`: 派送中
  * `Delivered` / `Selesai`: 已完成签收
  * `Cancelled`: 已取消
* `pod_photo_url`: 货物卸货现场照片
* `pod_signature_url` / `proof_of_load_url`: 客户签字盖章 DO 单据照片
* `pod_timestamp`: 签收时间戳 (MYT)

### 1.3 `live_stock` / `factory_inventory` (工厂实时库存表)
* `item_id`: 物料/产品 ID
* `factory_id`: 所属厂区 (`OPM Lama`, `Nilai`, `Kelantan`, `Johor`, `SPD` 等)
* `quantity`: 当前实时库存量（气泡膜单位为 Roll，原料为 kg）
* `min_stock`: 安全库存警戒线
* `updated_at`: 最后更新时间戳

### 1.4 `employee_leave` (请假记录表)
* `id`: UUID
* `user_id`: 申请人 ID
* `user_name`: 申请人姓名
* `role`: 角色
* `start_date` / `end_date`: 请假起止日期
* `total_days`: 请假总天数
* `leave_type`: 请假类型 (`Annual`, `Medical`, `Emergency`, `Unpaid`)
* `reason`: 请假理由
* `status`:
  * `Pending`: 待 HR 审核
  * `Approved`: 已批准（自动同步全员日历）
  * `Rejected`: 已拒绝
* `reviewed_by`: 审核人

### 1.5 `driver_extra_tasks` / `work_photos` (司机额外任务记录)
* `id`: UUID
* `driver_id`: 司机 ID
* `category`: `SHOPEE` | `AMBIK PALLET` | `LORRY SERVICE` | `RETURN` | `OTHER`
* `amount`: 审核认定的补贴金额 (RM)
* `photo_url`: 现场凭证照片
* `notes`: 司机填写的说明
* `status`: `Pending` | `Approved` | `Rejected`
* `approved_by`: 审批人 ID
* `approved_at`: 审批时间戳
