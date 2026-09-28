# Packsecure 司机运费与送货价格真理库 (Driver Pricing Rulebook)
**版本 / Version**: `v2.1.0 (Excel 官方对照校准版)` ｜ **更新日期 / Date**: `2026-09-28` ｜ **审核人 / Owner**: `HR & Logistics` ｜ **状态 / Status**: `Active`

> **说明 (Instruction)**: 本文档是 Packsecure 司机送货价格计算的核心业务真理，与系统数据库 `delivery_rates` 官方有效运费表及工厂最新核定 Excel 100% 对齐。覆盖 **太平 (TAIPING)**、**汝来 (NILAI)**、**柔佛 (JOHOR)** 与 **吉兰丹 (KELANTAN)** 4 大出车起运基地。AI 运费核算引擎与 HR 审核工作台均以此规则为最高依据。任何管理人员或 HR 均可在前端在线修改并一键发布新版本。

---

## 1. 核心计费公式与基本原则 (Fundamental Rules)
1. **单趟行程计费公式 (Per-Trip Formula)**：
   $$\text{Trip Earnings} = \text{Base Rate (基准运费)} + \max(0, \text{Drops} - \text{Max Places}) \times \text{Extra Rate Per Place (超点补贴)} + \text{特殊额外任务补贴}$$
   - **`Base Rate (基准运费)`**：依据 **起运工厂 (`trip_origin`)** 与 **送达区域 (`zone` / `location_name`)** 匹配对应起步价。
   - **`Max Places (免费落点数)`**：该区域基准运费包含的送货目的地数量，未超出时不加收超点费。
   - **`Extra Rate Per Place (超点补贴)`**：送货落点数超出 `Max Places` 后，每增加 1 个经停客户点加发的津贴（通常为 +RM 5、+RM 10 或 +RM 15 / 点）。
2. **多单合并一趟 (Trip Grouping)**：
   同一名司机在同一天送往相同或顺路方向的多张销售订单 (DO)，统一视为同一趟行程 (Trip) 进行运费核算，不重复发放多份基础运费。
3. **4 大起运基地 (Origin Hubs)**：
   系统支持以下 4 个工厂出车起点。若单据未注明，默认按司机档案归属或 **TAIPING (太平总厂)** 起运：
   - **TAIPING (太平 / OPM Lama / SPD)**
   - **NILAI (汝来)**
   - **JOHOR (柔佛 / Weheng)**
   - **KELANTAN (吉兰丹)**
4. **车型容量与特殊费率差异 (Vehicle Adaptation)**：
   - 标准卡车容量基准：**82 卷气泡膜**。
   - 特殊车辆 **`VPC 9821`**：65 卷轻卡，若路线或区域注明 VPC 专属费率（如 `[VPC_RATE: 75]` 等），优先适用 VPC 费率。
   - 特殊车辆 **`APH 9821`**：92 卷重卡。
5. **现场特殊支援任务补贴 (Extra Allowances)**：
   司机在日常干线/外坡送货之外，在厂区或本地完成的现场支援任务，经照片存证与 HR 审核后计入当月工资：
   - 🛍️ **`OPM - SHOPEE/SPD` (或 `SHOPEE / SPD`) 散单送件**：**RM 20.00** / 趟（包含 1 点，超点 +RM 20 / 点）
   - 🚚 **`TAIPING TRIP` 厂区驳运**：**RM 7.00** / 趟（包含 1 点，超点 +RM 7 / 点）
   - 🪵 **`AMBIL PALLET` (或 `AMBIK PALLET`) 搬运托盘**：**RM 10.00** / 趟
   - 🔧 **`LORRY SERVICE` 送修验车 (Puspakom)**：**RM 15.00** / 趟
   - ↩️ **`RETURN` / `OTHER`**：客户退货调拨或特定临时任务，由 Admin / Manager 依实际路程特批审核。

---

## 2. 太平厂起运 (TAIPING Origin) 价目表
> 太平总厂 (TAIPING / OPM Lama) 出车，覆盖霹雳本地、槟城威省、吉打玻州、雪隆森美兰及东海岸各州的标准配送费率（与官方 Excel 表完全一致）：

### 2.1 太平标准生效价目表 (Active Rates)
| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **KUALA TERENGGANU** | **RM 480** | 3 点 | +RM 15 / 点 | - |
| **BESUT** | **RM 430** | 3 点 | +RM 15 / 点 | - |
| **NEGERI SEMBILAN** | **RM 400** | 3 点 | +RM 15 / 点 | - |
| **JENGKA** | **RM 380** | 3 点 | +RM 10 / 点 | Official Excel: Jengka (Pahang) |
| **KELANTAN** | **RM 380** | 3 点 | +RM 15 / 点 | - |
| **KOTA BHARU** | **RM 380** | 3 点 | +RM 15 / 点 | - |
| **BENTONG** | **RM 330** | 3 点 | +RM 10 / 点 | - |
| **KARAK** | **RM 330** | 3 点 | +RM 10 / 点 | Official Excel: Karak (Pahang) |
| **KL** | **RM 330** | 3 点 | +RM 10 / 点 | Official Excel: KL (3 places included, +10/place) |
| **KL (1 TEMPAT)** | **RM 250** | 0 点 | +RM 0 / 点 | - |
| **ARAU** | **RM 165** | 3 点 | +RM 5 / 点 | - |
| **BUKIT KAYU HITAM** | **RM 165** | 3 点 | +RM 5 / 点 | - |
| **KANGAR** | **RM 165** | 3 点 | +RM 5 / 点 | - |
| **KUALA PERLIS** | **RM 165** | 3 点 | +RM 5 / 点 | - |
| **PADANG BESAR** | **RM 165** | 3 点 | +RM 5 / 点 | - |
| **ALOR SETAR** | **RM 150** | 3 点 | +RM 5 / 点 | - |
| **BALING** | **RM 150** | 3 点 | +RM 5 / 点 | - |
| **JITRA** | **RM 150** | 3 点 | +RM 5 / 点 | - |
| **KEDAH** | **RM 150** | 3 点 | +RM 5 / 点 | - |
| **SIK** | **RM 150** | 3 点 | +RM 5 / 点 | - |
| **BEDONG** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **PENDANG** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **SIMPANG EMPAT (KEDAH)** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **SUNGAI PETANI** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **SUNGKAI** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **TANJUNG MALIM** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **TELUK INTAN** | **RM 100** | 3 点 | +RM 5 / 点 | - |
| **BM** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **FULL DAY SHOPEE** | **RM 80** | 0 点 | +RM 0 / 点 | - |
| **IPOH** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **KAMPAR** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **KULIM** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **PENANG** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **SIMPANG AMPAT (PENANG)** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **SITIAWAN** | **RM 80** | 3 点 | +RM 5 / 点 | - |
| **OPM - SHOPEE/SPD** | **RM 20** | 1 点 | +RM 20 / 点 | Official Excel: OPM - Shopee/Spd (+20/place extra) |
| **SHOPEE** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SHOPEE / SPD** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **LORRY SERVICE** | **RM 15** | 0 点 | +RM 0 / 点 | - |
| **AMBIK PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | Alias for Ambil Pallet |
| **AMBIL PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | Official Excel: Ambil Pallet |
| **TAIPING TRIP** | **RM 7** | 1 点 | +RM 7 / 点 | Official Excel: Taiping Trip (+7/place extra) |

### 2.2 太平待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **JOHOR** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **LUNAS** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **OTHER** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **PAHANG** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **PERAK** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **PERLIS** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **RETURN** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SELANGOR** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **SERI MANJUNG** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **TAIPING** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |


---

## 3. 汝来厂起运 (NILAI Origin) 价目表
> 汝来基地 (NILAI) 出车，向森美兰、雪兰莪、吉隆坡、马六甲、彭亨、登嘉楼及柔佛等地的配送费率：

### 3.1 汝来标准生效价目表 (Active Rates)
| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **DUNGUN** | **RM 320** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **PAKA** | **RM 300** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KEMAMAN TERENG** | **RM 280** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KEMAMAN TERENGGANU** | **RM 280** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **JOHOR BAHRU** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KOTA TINGGI** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **kuantan** | **RM 250** | 3 点 | +RM 10 / 点 | - |
| **KULAI** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **PEKAN** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **PONTIAN** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **ROMPIN** | **RM 250** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **BATU PAHAT** | **RM 200** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KLUANG** | **RM 200** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **LABIS** | **RM 200** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **MERSING** | **RM 200** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **WEHENG / YANG IN** | **RM 200** | 1 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **SABAK BERNAM** | **RM 160** | 5 点 | +RM 5 / 点 | Official Excel: Nilai Origin |
| **JERANTUT** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **LIPAS** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **LIPIS** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **MARAN** | **RM 150** | 2 点 | +RM 10 / 点 | - |
| **MUAR** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **RAUB** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **SEGAMAT** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **TANGKAK** | **RM 150** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **TEMERLOH** | **RM 150** | 3 点 | +RM 10 / 点 | - |
| **KUALA SELANGOR** | **RM 140** | 5 点 | +RM 5 / 点 | Official Excel: Nilai Origin |
| **TANJUNG KARANG** | **RM 140** | 5 点 | +RM 5 / 点 | Official Excel: Nilai Origin |
| **BERA** | **RM 120** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KEMAYAN (PAHANG)** | **RM 120** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **MELAKA** | **RM 120** | 2 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **BATANG KALI** | **RM 100** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KAPAR** | **RM 100** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **PUNCAK ALAM** | **RM 100** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **RASA** | **RM 100** | 3 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **BENTONG** | **RM 80** | 1 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **KL** | **RM 80** | 1 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **NEGERI SEMBILAN** | **RM 80** | 2 点 | +RM 5 / 点 | Official Excel: Nilai Origin |
| **SELANGOR** | **RM 80** | 1 点 | +RM 10 / 点 | Official Excel: Nilai Origin |
| **NILAI** | **RM 30** | 1 点 | +RM 0 / 点 | Official Excel: Nilai Origin |
| **SHOPEE** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SHOPEE / SPD** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **LORRY SERVICE** | **RM 15** | 0 点 | +RM 0 / 点 | Official Excel: Nilai Origin |
| **AMBIK PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | Official Excel: Nilai Origin |
| **AMBIL PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | Official Excel: Nilai Origin |
| **NILAI (loose)** | **RM 10** | 1 点 | +RM 0 / 点 | Official Excel: Nilai Origin |
| **TAIPING TRIP** | **RM 7** | 1 点 | +RM 0 / 点 | Extra Job Rate |

### 3.2 汝来待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **JOHOR** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **KUALA LUMPUR** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **OTHER** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **PAHANG** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **RETURN** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SE** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **TANJUNG SEPAT** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **TERENGGANU** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |


---

## 4. 柔佛厂起运 (JOHOR Origin) 价目表
> 柔佛基地 (JOHOR) 出车，向新山、古来、笨珍、峇株巴辖、居銮、麻坡、丰盛港及昔加末等地的配送费率：

### 4.1 柔佛标准生效价目表 (Active Rates)
| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **MERSING** | **RM 130** | 1 点 | +RM 10 / 点 | - |
| **SEGAMAT** | **RM 130** | 1 点 | +RM 10 / 点 | - |
| **MUAR** | **RM 120** | 1 点 | +RM 10 / 点 | - |
| **TANGKAK** | **RM 120** | 1 点 | +RM 10 / 点 | - |
| **BATU PAHAT** | **RM 90** | 1 点 | +RM 10 / 点 | - |
| **KLUANG** | **RM 90** | 1 点 | +RM 10 / 点 | - |
| **PONTIAN** | **RM 60** | 1 点 | +RM 10 / 点 | - |
| **KOTA TINGGI** | **RM 50** | 1 点 | +RM 10 / 点 | - |
| **JOHOR BAHRU** | **RM 40** | 1 点 | +RM 10 / 点 | - |
| **WEHENG** | **RM 40** | 1 点 | +RM 0 / 点 | - |
| **WEHENG / YANG IN** | **RM 40** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **KULAI** | **RM 30** | 1 点 | +RM 10 / 点 | - |
| **SHOPEE** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SHOPEE / SPD** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **LORRY SERVICE** | **RM 15** | 0 点 | +RM 0 / 点 | - |
| **AMBIK PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | - |
| **TAIPING TRIP** | **RM 7** | 1 点 | +RM 0 / 点 | Extra Job Rate |

### 4.2 柔佛待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **JOHOR** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **MELAKA** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **NILAI** | **RM 0** | 1 点 | +RM 0 / 点 | Auto-imported from Trip form. HR please update rate. |
| **OTHER** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **RETURN** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |


---

## 5. 吉兰丹厂起运 (KELANTAN Origin) 价目表
> 吉兰丹基地 (KELANTAN) 出车，向哥打峇鲁、巴西马、道北、马樟、巴西富地、丹那美拉、日里及话望生等地的配送费率：

### 5.1 吉兰丹标准生效价目表 (Active Rates)
| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **GUA MUSANG** | **RM 160** | 1 点 | +RM 10 / 点 | - |
| **JELI** | **RM 80** | 1 点 | +RM 10 / 点 | - |
| **KUALA KRAI** | **RM 60** | 1 点 | +RM 10 / 点 | - |
| **TANAH MERAH** | **RM 50** | 1 点 | +RM 10 / 点 | - |
| **MACHANG** | **RM 40** | 1 点 | +RM 10 / 点 | - |
| **PASIR PUTEH** | **RM 40** | 1 点 | +RM 5 / 点 | - |
| **BACHOK** | **RM 30** | 1 点 | +RM 5 / 点 | - |
| **PASIR MAS** | **RM 30** | 1 点 | +RM 5 / 点 | - |
| **TUMPAT** | **RM 30** | 1 点 | +RM 5 / 点 | - |
| **KOTA BHARU** | **RM 20** | 1 点 | +RM 5 / 点 | - |
| **SHOPEE** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **SHOPEE / SPD** | **RM 20** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **LORRY SERVICE** | **RM 15** | 0 点 | +RM 0 / 点 | - |
| **AMBIK PALLET** | **RM 10** | 0 点 | +RM 0 / 点 | - |
| **TAIPING TRIP** | **RM 7** | 1 点 | +RM 0 / 点 | Extra Job Rate |

### 5.2 吉兰丹待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |
| :--- | :---: | :---: | :---: | :--- |
| **OTHER** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |
| **RETURN** | **RM 0** | 1 点 | +RM 0 / 点 | Extra Job Rate |


---

## 6. 常见地名消歧与归属判定准则 (Ambiguity Resolution Rules)
- **Menglembu / 万里望**：属于霹雳怡保近郊，按 **IPOH (RM 80)** 结算。
- **Batu Kawan / 峇都交湾**：属于槟城威南，按 **SIMPANG AMPAT (PENANG) (RM 80)** 结算。
- **Bukit Minyak / 武吉敏惹**：属于槟城威中，按 **BM (RM 80)** 结算。
- **Nilai 3 / 汝来 3 工业区**：若从太平起运按 **NEGERI SEMBILAN (RM 400)** 结算；若从汝来本地起运按 **NILAI (RM 30)** 或 **NEGERI SEMBILAN (RM 80)** 结算。
- **Karak / 加叻**：属于彭亨近郊，太平起运按 **KARAK (RM 330, 3点, +RM 10/点)** 结算。
- **Jengka / 增卡**：属于彭亨腹地，太平起运按 **JENGKA (RM 380, 3点, +RM 10/点)** 结算。
- **Skudai / 士姑来**：属于柔佛新山近郊，柔佛起运按 **JOHOR BAHRU (RM 40)** 结算。
- **Rawang / 煤炭山**：属于雪兰莪，汝来起运按 **SELANGOR (RM 80)** 结算；太平起运按 **KL** 相应标准结算。
- **多单拼车计费原则**：同一趟行程包含多个城镇时，以**最远核心目的地**作为 Base Rate，其余经停点按超点补贴 (+RM 5 ~ +RM 15 / 点) 累计。
