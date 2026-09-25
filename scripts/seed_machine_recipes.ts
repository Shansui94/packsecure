/**
 * Seeds and synchronizes all 12 machines' real recipes across 4 factories:
 * - Taiping: T1-M03, T4-M04, T2-M01, T3-M02, T5-M05
 * - Nilai: N1-M01, N2-M02, N3-M03
 * - Johor: J1-M01, J1-M02
 * - Kelantan: K1-M01, K1-M02
 * 
 * Populates:
 * 1. bom_headers_v2 & bom_items_v2 (central standard recipes)
 * 2. work_photos (category: MACHINE_SCREW_FORMULA) for mobile shopfloor sync
 * 3. master_items weights check
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface StandardMachineRecipe {
  machineKey: string; // T1, T2, T3, T4, T5, N1, N2, N3, J1, J2, K1, K2
  machineId: string;  // T1-M03, etc.
  machineName: string;
  factoryId: string;
  machineType: 'Stretch Film' | '2M Bubble Wrap' | '1M Bubble Wrap' | 'Recycle';
  sku: string;
  productName: string;
  netWeightKg: number;
  coreWeightKg: number;
  grossWeightKg: number;
  packSpec: string;
  screws: {
    screwId: 'Screw_A' | 'Screw_B' | 'Screw_C';
    screwName: string;
    items: {
      name: string;
      sku: string;
      unit: 'bag' | 'kg';
      qty: number;
      notes?: string;
    }[];
  }[];
}

export const ALL_12_MACHINE_RECIPES: StandardMachineRecipe[] = [
  // ── 1. TAIPING (OPM LAMA) ──────────────────────────────────────────────────
  {
    machineKey: 'T1',
    machineId: 'T1-M03',
    machineName: 'Stretch Film (T1)',
    factoryId: 'T1',
    machineType: 'Stretch Film',
    sku: 'SF-CLEAR-2.2-50CM',
    productName: 'SF CLEAR 2.2KG X 50CM (6ROLLS/CTN)',
    netWeightKg: 2.00,
    coreWeightKg: 0.20,
    grossWeightKg: 2.20,
    packSpec: '6 卷 / 箱 (整箱毛重 13.2kg)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (外层主螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 15, notes: '主料 LLDPE (375kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 10, notes: '再生颗粒增韧' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 0 },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 0 },
          { name: 'Black (黑母粒)', sku: 'RM-MB-BLACK', unit: 'kg', qty: 0 }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (中层辅螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 10, notes: '主料 LLDPE (250kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 25, notes: '再生料 (25kg)' }
        ]
      }
    ]
  },
  {
    machineKey: 'T4',
    machineId: 'T4-M04',
    machineName: 'Stretch Film (T4)',
    factoryId: 'T1',
    machineType: 'Stretch Film',
    sku: 'SF-CLEAR-2.2-50CM',
    productName: 'SF CLEAR 2.2KG X 50CM (6ROLLS/CTN)',
    netWeightKg: 2.00,
    coreWeightKg: 0.20,
    grossWeightKg: 2.20,
    packSpec: '6 卷 / 箱 (整箱毛重 13.2kg)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (外层主螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 15, notes: '主料 LLDPE (375kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 10, notes: '再生颗粒增韧' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (中层辅螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 10, notes: '主料 LLDPE (250kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '再生料 (20kg)' }
        ]
      }
    ]
  },
  {
    machineKey: 'T2',
    machineId: 'T2-M01',
    machineName: '2M Double Layer (T2)',
    factoryId: 'T1',
    machineType: '2M Bubble Wrap',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '2米双层气泡膜标准卷 (分切 1m / 50cm / 33cm)',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 或 33cm×3卷捆',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (正面平膜螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 8, notes: 'LLDPE 基材 (200kg)' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '高密增硬 (125kg)' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 5, notes: '增韧抗撕裂 (125kg)' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 2, notes: '低密 (50kg)' },
          { name: 'LDPE 6238', sku: 'RM-LDPE-6238', unit: 'bag', qty: 2, notes: '低密 (50kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 10, notes: '再生颗粒 (10kg)' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (中间气泡成型螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 11, notes: 'LLDPE 主料 (275kg)' },
          { name: 'HDPE 聚乙烯料', sku: 'RM-HDPE-BASE', unit: 'bag', qty: 6, notes: '气泡支撑强度 (150kg)' },
          { name: '2192J / 18020SA / L1220F', sku: 'RM-MIX-2192J', unit: 'bag', qty: 4, notes: '高延展母料 (100kg)' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 3, notes: '平滑抗脆 (75kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '再生颗粒 (20kg)' },
          { name: 'Plastic (透明塑料料)', sku: 'RM-PLASTIC', unit: 'kg', qty: 10, notes: '透明润滑助剂 (10kg)' }
        ]
      },
      {
        screwId: 'Screw_C',
        screwName: 'Screw C (底膜层螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 8, notes: 'LLDPE (200kg)' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: 'HDPE (125kg)' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 3, notes: 'LDPE (75kg)' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 15, notes: '再生料 (15kg)' }
        ]
      }
    ]
  },
  {
    machineKey: 'T3',
    machineId: 'T3-M02',
    machineName: '1M Single Layer (T3)',
    factoryId: 'T1',
    machineType: '1M Bubble Wrap',
    sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
    productName: '1米单层透明气泡膜 (MERAH / OREN)',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '100cm×1卷 (MERAH) 或 50cm×2卷捆 (OREN)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜/外层)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (气泡成型层)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      }
    ]
  },
  {
    machineKey: 'T5',
    machineId: 'T5-M05',
    machineName: 'Recycle Machine (T5)',
    factoryId: 'T1',
    machineType: 'Recycle',
    sku: 'RM-REC-MIX',
    productName: '太平厂塑料再生回收颗粒 (Pellets)',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋 (吨装 40包/托)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: '造粒主挤出机',
        items: [
          { name: '气泡膜机台切边废料', sku: 'WASTE-BW', unit: 'kg', qty: 300, notes: '干净白边料' },
          { name: '缠绕膜回收下脚料', sku: 'WASTE-SF', unit: 'kg', qty: 200, notes: '拉伸膜高拉力料' },
          { name: '外购/厂内回料', sku: 'RM-RECYCLE', unit: 'kg', qty: 100, notes: '造粒助剂增粘' }
        ]
      }
    ]
  },

  // ── 2. NILAI (CENTRAL HUB) ─────────────────────────────────────────────────
  {
    machineKey: 'N1',
    machineId: 'N1-M01',
    machineName: '1M Double Layer (N1)',
    factoryId: 'N1',
    machineType: '1M Bubble Wrap',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '汝来 1米双层透明气泡膜 (DL-FULL / DL-HALF)',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 (黄色) 或 50cm×2卷捆 (蓝色)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜/外层)',
        items: [
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'LL OREN/ LLB2919', sku: 'RM-LLB2919', unit: 'bag', qty: 2, notes: '50kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (气泡成型层)',
        items: [
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      }
    ]
  },
  {
    machineKey: 'N2',
    machineId: 'N2-M02',
    machineName: '1M Single Layer (N2)',
    factoryId: 'N1',
    machineType: '1M Bubble Wrap',
    sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN',
    productName: '汝来 1米单层气泡膜 (OREN 50CM / MERAH 100CM)',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '50cm×2卷捆 (OREN) 或 100cm×1卷 (MERAH)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜/成型)',
        items: [
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'LL OREN/ LLB2919', sku: 'RM-LLB2919', unit: 'bag', qty: 2, notes: '50kg' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      }
    ]
  },
  {
    machineKey: 'N3',
    machineId: 'N3-M03',
    machineName: 'Recycle Machine (N3)',
    factoryId: 'N1',
    machineType: 'Recycle',
    sku: 'RM-REC-MIX',
    productName: '汝来厂再生回收颗粒 (Pellets)',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: '造粒主挤出机',
        items: [
          { name: '汝来气泡膜机切边料', sku: 'WASTE-BW', unit: 'kg', qty: 400, notes: '透明废料' },
          { name: '回料稳定剂', sku: 'RM-RECYCLE', unit: 'kg', qty: 50, notes: '增强熔融指数' }
        ]
      }
    ]
  },

  // ── 3. JOHOR (SOUTH HUB) ───────────────────────────────────────────────────
  {
    machineKey: 'J1',
    machineId: 'J1-M01',
    machineName: '2M Double Layer (J1)',
    factoryId: 'J1',
    machineType: '2M Bubble Wrap',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '柔佛 2米双层气泡膜标准卷 (供南马与新加坡)',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 或 33cm×3卷捆',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 8, notes: '200kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 2, notes: '50kg' },
          { name: 'LDPE 6238', sku: 'RM-LDPE-6238', unit: 'bag', qty: 2, notes: '50kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 10, notes: '10kg' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (气泡成型螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 11, notes: '275kg' },
          { name: 'HDPE 聚乙烯料', sku: 'RM-HDPE-BASE', unit: 'bag', qty: 6, notes: '150kg' },
          { name: '2192J / 18020SA / L1220F', sku: 'RM-MIX-2192J', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      },
      {
        screwId: 'Screw_C',
        screwName: 'Screw C (底膜层螺杆)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 8, notes: '200kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 15, notes: '15kg' }
        ]
      }
    ]
  },
  {
    machineKey: 'J2',
    machineId: 'J1-M02',
    machineName: 'Recycle Machine (J1)',
    factoryId: 'J1',
    machineType: 'Recycle',
    sku: 'RM-REC-MIX',
    productName: '柔佛厂塑料再生颗粒',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: '造粒主挤出机',
        items: [
          { name: '气泡膜机切边料', sku: 'WASTE-BW', unit: 'kg', qty: 400, notes: '透明废料' },
          { name: '回料再生料', sku: 'RM-RECYCLE', unit: 'kg', qty: 50, notes: '颗粒助剂' }
        ]
      }
    ]
  },

  // ── 4. KELANTAN (EAST COAST) ───────────────────────────────────────────────
  {
    machineKey: 'K1',
    machineId: 'K1-M01',
    machineName: '1M Double Layer (K1)',
    factoryId: 'K1',
    machineType: '1M Bubble Wrap',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '吉兰丹 1米双层透明气泡膜',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜/外层)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', qty: 3, notes: '75kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      },
      {
        screwId: 'Screw_B',
        screwName: 'Screw B (气泡成型层)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      }
    ]
  },
  {
    machineKey: 'K2',
    machineId: 'K1-M02',
    machineName: '1M Single Layer (K1)',
    factoryId: 'K1',
    machineType: '1M Bubble Wrap',
    sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN',
    productName: '吉兰丹 1米单层气泡膜',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '50cm×2卷捆 (OREN)',
    screws: [
      {
        screwId: 'Screw_A',
        screwName: 'Screw A (平膜/成型)',
        items: [
          { name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', qty: 6, notes: '150kg' },
          { name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', qty: 5, notes: '125kg' },
          { name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', qty: 4, notes: '100kg' },
          { name: 'Recycle (回料/碎料)', sku: 'RM-RECYCLE', unit: 'kg', qty: 20, notes: '20kg' }
        ]
      }
    ]
  }
];

async function seed() {
  console.log('🚀 Starting Full 12-Machine Recipe Seeding & Sync...');

  // 0. Ensure real shopfloor raw materials exist in master_items_v2 and master_items
  const RAW_MATERIALS_TO_SEED = [
    { sku: 'RM-C1802', name: 'C1802 / 7042 (LLDPE)', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-RECYCLE', name: 'Recycle (回料/碎料)', type: 'Raw', uom: 'kg' },
    { sku: 'RM-LDPE-2426H', name: 'LDPE 2426H', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-LDPE-6238', name: 'LDPE 6238', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-HDPE-7260', name: 'HDPE / GC 7260', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-HDPE-BASE', name: 'HDPE 聚乙烯料', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-L1220F', name: 'L1220F / 1218WJ', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-MIX-2192J', name: '2192J / 18020SA / L1220F', type: 'Raw', uom: 'Bag' },
    { sku: 'RM-MB-BLACK', name: 'Black (黑母粒)', type: 'Raw', uom: 'kg' },
    { sku: 'RM-PLASTIC', name: 'Plastic (透明塑料料)', type: 'Raw', uom: 'kg' },
    { sku: 'RM-LLB2919', name: 'LL OREN/ LLB2919', type: 'Raw', uom: 'Bag' },
    { sku: 'WASTE-BW', name: '气泡膜机切边料 (Waste BW)', type: 'Raw', uom: 'kg' },
    { sku: 'WASTE-SF', name: '缠绕膜回收下脚料 (Waste SF)', type: 'Raw', uom: 'kg' },
  ];

  console.log('📦 Seeding real raw materials into master_items_v2...');
  for (const rm of RAW_MATERIALS_TO_SEED) {
    await supabase.from('master_items_v2').upsert({
      sku: rm.sku,
      name: rm.name,
      type: rm.type,
      uom: rm.uom,
      status: 'Active'
    }, { onConflict: 'sku' });

    await supabase.from('master_items').upsert({
      sku: rm.sku,
      name: rm.name,
      type: rm.type,
      uom: rm.uom,
      status: 'Active'
    }, { onConflict: 'sku' });
  }

  for (const m of ALL_12_MACHINE_RECIPES) {
    console.log(`\n📌 Processing Machine: [${m.machineKey}] ${m.machineName} (${m.machineId})`);

    // 1. Calculate weights and total batch kg
    let totalKg = 0;
    const mobileScrewsObj: Record<string, any[]> = {
      Screw_A: [],
      Screw_B: [],
      Screw_C: []
    };

    m.screws.forEach(sc => {
      sc.items.forEach((it, idx) => {
        const itemKg = it.unit === 'bag' ? it.qty * 25 : it.qty;
        totalKg += itemKg;

        mobileScrewsObj[sc.screwId].push({
          id: `${sc.screwId.toLowerCase()}_${idx + 1}`,
          name: it.name,
          sku: it.sku,
          unit: it.unit,
          prevQty: it.qty,
          newQty: it.qty
        });
      });
    });

    // 2. Upsert into bom_headers_v2 using valid UUIDs
    const machineUuids: Record<string, string> = {
      T1: '00000000-0000-0000-0001-000000000001',
      T4: '00000000-0000-0000-0001-000000000004',
      T2: '00000000-0000-0000-0001-000000000002',
      T3: '00000000-0000-0000-0001-000000000003',
      T5: '00000000-0000-0000-0001-000000000005',
      N1: '00000000-0000-0000-0002-000000000001',
      N2: '00000000-0000-0000-0002-000000000002',
      N3: '00000000-0000-0000-0002-000000000003',
      J1: '00000000-0000-0000-0003-000000000001',
      J2: '00000000-0000-0000-0003-000000000002',
      K1: '00000000-0000-0000-0004-000000000001',
      K2: '00000000-0000-0000-0004-000000000002'
    };

    const recipeUuid = machineUuids[m.machineKey] || '00000000-0000-0000-0001-000000000001';

    const headerPayload = {
      recipe_id: recipeUuid,
      sku: m.sku,
      name: `${m.machineName} 标准生产配方`,
      is_default: true,
      machine_type: m.machineId
    };

    const { error: hError } = await supabase
      .from('bom_headers_v2')
      .upsert(headerPayload, { onConflict: 'recipe_id' });

    if (hError) {
      console.warn(`  ⚠️ bom_headers_v2 upsert error for ${m.machineKey}:`, hError.message);
    } else {
      console.log(`  ✅ bom_headers_v2 updated: [${m.machineKey}] ${headerPayload.recipe_id}`);
    }

    // 3. Clear and insert bom_items_v2
    await supabase.from('bom_items_v2').delete().eq('recipe_id', headerPayload.recipe_id);

    const bomItemsToInsert: any[] = [];
    m.screws.forEach(sc => {
      sc.items.forEach((it, idx) => {
        if (it.qty <= 0) return; // skip 0 qty
        const itemKg = it.unit === 'bag' ? it.qty * 25 : it.qty;
        const ratio = totalKg > 0 ? Number(((itemKg / totalKg) * 100).toFixed(1)) : 0;

        bomItemsToInsert.push({
          recipe_id: headerPayload.recipe_id,
          material_sku: it.sku,
          layer_name: sc.screwName,
          ratio_percentage: ratio,
          notes: `${it.name}: ${it.qty}${it.unit === 'bag' ? '包' : 'kg'} (${it.notes || ''})`,
          scrap_percent: 0.015
        });
      });
    });

    if (bomItemsToInsert.length > 0) {
      const { error: biError } = await supabase.from('bom_items_v2').insert(bomItemsToInsert);
      if (biError) {
        console.warn(`  ⚠️ bom_items_v2 insert error:`, biError.message);
      } else {
        console.log(`  ✅ Inserted ${bomItemsToInsert.length} items to bom_items_v2`);
      }
    }

    // 4. Upsert into work_photos under MACHINE_SCREW_FORMULA for mobile workshop sync
    // Delete existing old active formula for this machine to keep 1 active truth
    await supabase
      .from('work_photos')
      .delete()
      .eq('category', 'MACHINE_SCREW_FORMULA')
      .eq('machine_id', m.machineKey);

    const { error: wpError } = await supabase.from('work_photos').insert({
      employee_id: '8335',
      employee_name: 'Max Tan (SuperAdmin Sync)',
      machine_id: m.machineKey,
      category: 'MACHINE_SCREW_FORMULA',
      user_note: JSON.stringify(mobileScrewsObj),
      photo_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80',
      location: m.factoryId
    });

    if (wpError) {
      console.warn(`  ⚠️ work_photos sync error for ${m.machineKey}:`, wpError.message);
    } else {
      console.log(`  ✅ Synced live mobile formula to work_photos for Machine Key [${m.machineKey}]`);
    }

    // 5. Ensure master_items has exact net_weight_kg, core_weight_kg, gross_weight_kg
    await supabase
      .from('master_items')
      .update({
        net_weight_kg: m.netWeightKg,
        core_weight_kg: m.coreWeightKg,
        gross_weight_kg: m.grossWeightKg
      })
      .eq('sku', m.sku);
  }

  // 6. Bulk align all Double Layer (DL = 5.6kg) and Single Layer (SL = 3.8kg) in master_items
  const { data: allFGs } = await supabase.from('master_items').select('sku');
  if (allFGs) {
    for (const item of allFGs) {
      const skuUpper = item.sku.toUpperCase();
      if (skuUpper.includes('BW-DL') || skuUpper.startsWith('DL-')) {
        await supabase.from('master_items').update({
          net_weight_kg: 5.60,
          core_weight_kg: 0.00,
          gross_weight_kg: 5.60
        }).eq('sku', item.sku);
      } else if (skuUpper.includes('BW-SL') || skuUpper.startsWith('SL-') || skuUpper === 'MERAH' || skuUpper === 'OREN') {
        await supabase.from('master_items').update({
          net_weight_kg: 3.80,
          core_weight_kg: 0.00,
          gross_weight_kg: 3.80
        }).eq('sku', item.sku);
      }
    }
  }

  console.log('\n🎉 ALL 12 MACHINES RECIPES SEEDED & SYNCHRONIZED SUCCESSFULLY (SL: 3.8kg, DL: 5.6kg)!');
}

seed().catch(console.error);
