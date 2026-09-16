# PackSecure 生产设备标签 SOP (Standard Operating Procedure)

本文档旨在指导工厂管理人员如何正确生成、打印、安装和使用机器 QR 识别码系统。

---

## 1. 核心设备标签清单 (Core Machines)

各厂区机台编号必须与系统核心业务真理库（[docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md)）及机台清单（[QR_CODES_LIST.md](QR_CODES_LIST.md)）保持完全一致：

| 厂区 | 设备名称 | 生产线 (Line) | QR 码识别内容 (Machine ID) | 规格说明 |
| :--- | :--- | :--- | :--- | :--- |
| **太平 Lama** | **Stretch Film (T1)** | Taiping T1 | `T1-M03` | 缠绕膜机台 |
| **太平 Lama** | **2M Double Layer (T2)** | Taiping T2 | `T2-M01` | 2米双层气泡膜机台 |
| **太平 Lama** | **1M Single Layer (T3)** | Taiping T3 | `T3-M02` | 1米单层气泡膜机台 |
| **太平 Lama** | **Stretch Film (T4)** | Taiping T4 | `T4-M04` | 缠绕膜机台 |
| **太平 Lama** | **Recycle Machine (T5)** | Taiping T5 | `T5-M05` | 塑料回收造粒机台 |
| **汝来 Nilai** | **1M Double Layer (N1)** | Nilai N1 | `N1-M01` | 1米双层气泡膜机台 |
| **汝来 Nilai** | **1M Single Layer (N2)** | Nilai N2 | `N2-M02` | 1米单层气泡膜机台 |
| **汝来 Nilai** | **Recycle Machine (N3)** | Nilai N3 | `N3-M03` | 塑料回收造粒机台 |
| **吉兰丹** | **1M Double Layer (K1)** | Kelantan K1 | `K1-M01` | 1米双层气泡膜机台 |
| **吉兰丹** | **1M Single Layer (K1)** | Kelantan K1 | `K1-M02` | 1米单层气泡膜机台 |
| **柔佛 Johor**| **2M Double Layer (J1)** | Johor J1 | `J1-M01` | 2米双层气泡膜机台 |
| **柔佛 Johor**| **Recycle Machine (J1)** | Johor J1 | `J1-M02` | 塑料回收造粒机台 |

> 完整 12 台设备的详细清单及制作参数，请参阅 [QR_CODES_LIST.md](QR_CODES_LIST.md)。

---

## 2. 打印与制作规范

*   **QR 码生成内容**：文本必须与表格中的 `Machine ID` 严格一致（如 `T1-M03`、`T2-M01` 等），区分大小写，不要包含多余空格。
*   **尺寸设定**：每个 QR 码建议独立使用一张 **A4 纸**（或至少 15cm × 15cm），确保手机在 1.5 米外能够秒级识别。
*   **打印选项**：
    *   选择“**适应页面**” (Fit to Page)。
    *   建议使用 **彩色高对比度打印**（标题机台名称加粗，便于远距离目视识别）。
*   **表面保护**：车间现场油墨、灰尘及切刀机油容易污损标签，打印后务必：
    *   使用 **过塑 (Laminate)** 压膜密封，或
    *   贴在专用高透工业级亚克力保护套/透明塑料袋内。

---

## 3. 张贴位置说明

*   **高度**：离地约 **1.2 米至 1.5 米**（成年操作工平视视线高度，方便手机平举扫描）。
*   **位置**：
    1. 机器主控制台/配电柜旁（操作工日常作业与开工登记最频繁的位置）。
    2. 或机身平整外壳处，**严禁贴在发热机头、挤出螺杆护罩或高速运转部件附近**。
*   **光照**：确保工位照明良好，避免张贴在背光阴暗处或受强烈反光射灯直射的位置。

---

## 4. 操作人员流程 (SOP)

1.  **打开应用**：手机浏览器访问 Packsecure OS 生产系统（如 [https://packsecure.vercel.app](https://packsecure.vercel.app)）。
2.  **进入扫码**：在导航或首页选择 **车间生产扫码报工 (`Production Control`)**。
3.  **对焦识别**：将摄像头对准机器上的 QR 标签。
    *   *识别成功*：系统自动锁定当前机台，顶部状态栏高亮显示 `Connected to: [机台名称] (如 T1-M03)`。
    *   *识别失败*：擦拭手机摄像头镜头，或检查标签表面是否有反光、油污。
4.  **开始作业**：选择层数（单层/双层） -> 材质规格 -> 录入米数/卷数/重量 -> 确认提交产出。

---

> [!IMPORTANT]
> **严禁跨站扫码**：严禁将 A 机器的二维码带到 B 机器张贴或替代扫描，这会导致机台工时拆分、时薪计费及库存报工数据严重混乱。
