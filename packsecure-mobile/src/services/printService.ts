/**
 * Packsecure 工厂机台静默标签打印驱动
 * 支持蓝牙热敏打印机、网络 TCP 标签打印机静默出单
 */
export interface PrintLabelData {
  orderNo: string;
  skuName: string;
  cuttingSize?: string;
  rollsCount: number;
  operatorName: string;
  factoryName: string;
  timestamp: string;
}

export const PrintService = {
  /**
   * 搜索附近的蓝牙标签打印机
   */
  scanBluetoothPrinters: async () => {
    console.log('[Print Engine] 开始搜索车间蓝牙热敏打印机...');
    // 返回模拟检测到的蓝牙打印机列表
    return [
      { id: 'BT-PRINTER-01', name: 'Factory Label Printer T1 (Bluetooth)', address: '00:11:22:33:44:55' },
      { id: 'BT-PRINTER-02', name: 'Mobile Thermal Printer - Driver (Bluetooth)', address: '66:77:88:99:AA:BB' }
    ];
  },

  /**
   * 静默打印机台标签 (扫码后零弹窗瞬间出单)
   */
  printMachineLabelSilent: async (printerAddress: string, data: PrintLabelData): Promise<{ success: boolean; message: string }> => {
    console.log(`[Print Engine] 向打印机设备 [${printerAddress}] 发送 ESC/POS 标签指令...`);
    console.log(`[Print Engine] 打印内容: 单号=${data.orderNo}, SKU=${data.skuName}, 数量=${data.rollsCount}卷, 操作员=${data.operatorName}`);

    // 构建 ESC/POS 二进制打单指令 (模拟发送串口/蓝牙字节流)
    try {
      // 模拟 300ms 完成硬打印
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true, message: '标签静默打印成功！' };
    } catch (err: any) {
      return { success: false, message: `打印机响应超时或出纸异常: ${err.message}` };
    }
  },

  /**
   * 静默打印司机送货单据
   */
  printDeliveryReceiptSilent: async (printerAddress: string, tripNo: string, customerName: string): Promise<boolean> => {
    console.log(`[Print Engine] 打印司机送货单据: TripNo=${tripNo}, 客户=${customerName}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return true;
  }
};
