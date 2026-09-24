# Packsecure OS — 生产机台 QR 码清单 (Machine QR Codes List)

根据系统核心业务真理库（[docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md)）与机台配置（[src/data/factoryData.ts](src/data/factoryData.ts)），现场张贴的机台二维码内容必须与系统内机台 ID **100% 完全一致**。

车间操作工使用手机端扫码报工（`ProductionControl.tsx`）时，摄像头直接读取下方 **QR 内容 (Machine ID)** 自动锁定机台。

---

## 1. 全厂机台 QR 码清单 (12 台核心设备)

### 1.1 太平厂区 (Taiping / OPM Lama)
| 机台名称 | 生产线 / 区域 | 机台类型 | QR 码扫描内容 (Machine ID) | 默认时薪标准 (白班 / 夜班) |
| :--- | :--- | :--- | :--- | :--- |
| **Stretch Film (T1)** | Taiping T1 | 缠绕膜机台 (Extruder) | `T1-M03` | RM 10.00 / RM 15.00 |
| **2M Double Layer (T2)** | Taiping T2 | 2米双层气泡膜 (Extruder) | `T2-M01` | RM 10.00 / RM 15.00 |
| **1M Single Layer (T3)** | Taiping T3 | 1米单层气泡膜 (Extruder) | `T3-M02` | RM 8.00 / RM 13.00 |
| **Stretch Film (T4)** | Taiping T4 | 缠绕膜机台 (Extruder) | `T4-M04` | RM 10.00 / RM 15.00 |
| **Recycle Machine (T5)** | Taiping T5 | 塑料回收造粒机 (Recycle) | `T5-M05` | RM 10.00 / RM 10.00 |

### 1.2 汝来厂区 (Nilai - Central Hub)
| 机台名称 | 生产线 / 区域 | 机台类型 | QR 码扫描内容 (Machine ID) | 默认时薪标准 (白班 / 夜班) |
| :--- | :--- | :--- | :--- | :--- |
| **1M Double Layer (N1)** | Nilai N1 | 1米双层气泡膜 (Extruder) | `N1-M01` | RM 10.00 / RM 15.00 |
| **1M Single Layer (N2)** | Nilai N2 | 1米单层气泡膜 (Extruder) | `N2-M02` | RM 10.00 / RM 15.00 |
| **Recycle Machine (N3)** | Nilai N3 | 塑料回收造粒机 (Recycle) | `N3-M03` | RM 10.00 / RM 10.00 |

### 1.3 吉兰丹厂区 (Kelantan - East Coast)
| 机台名称 | 生产线 / 区域 | 机台类型 | QR 码扫描内容 (Machine ID) | 默认时薪标准 (白班 / 夜班) |
| :--- | :--- | :--- | :--- | :--- |
| **1M Double Layer (K1)** | Kelantan K1 | 1米双层气泡膜 (Extruder) | `K1-M01` | RM 10.00 / RM 15.00 |
| **1M Single Layer (K1)** | Kelantan K1 | 1米单层气泡膜 (Extruder) | `K1-M02` | RM 10.00 / RM 15.00 |

### 1.4 柔佛厂区 (Johor - South Hub)
| 机台名称 | 生产线 / 区域 | 机台类型 | QR 码扫描内容 (Machine ID) | 默认时薪标准 (白班 / 夜班) |
| :--- | :--- | :--- | :--- | :--- |
| **2M Double Layer (J1)** | Johor J1 | 2米双层气泡膜 (Extruder) | `J1-M01` | RM 10.00 / RM 15.00 |
| **Recycle Machine (J1)** | Johor J1 | 塑料回收造粒机 (Recycle) | `J1-M02` | RM 10.00 / RM 10.00 |

---

## 2. 制作与张贴规范

1. **生成内容**：直接复制表格中 **“QR 码扫描内容”**（纯文本字符，如 `T1-M03`、`T2-M01` 等，严禁添加多余前后空格或前缀）。
2. **尺寸建议**：
   - 生产机台控制台主标签：**A4 纸**（彩色过塑，便于工人远距离 1.5 米扫码）。
   - 辅助备用贴纸：**10cm × 10cm** 防水防油标签。
3. **防护要求**：车间塑料粉尘与油墨多，务必进行过塑 (Laminate) 或加装透明防护罩。
4. **位置要求**：张贴于机台主配电箱或控制面板侧方，避开高热机头或运动机械部件。
