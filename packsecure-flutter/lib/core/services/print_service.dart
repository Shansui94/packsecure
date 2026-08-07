import 'package:flutter/foundation.dart';

class LabelData {
  final String orderNo;
  final String skuName;
  final String? cuttingSize;
  final int rollsCount;
  final String operatorName;
  final String factoryName;

  LabelData({
    required this.orderNo,
    required this.skuName,
    this.cuttingSize,
    required this.rollsCount,
    required this.operatorName,
    required this.factoryName,
  });
}

/// 工业标签静默打印驱动
class GooglePrintService {
  /// 静默打印机台标签 (零弹窗直接出单)
  static Future<bool> printLabelSilent(LabelData data) async {
    if (kDebugMode) {
      print('[Flutter Print] 向串口/蓝牙热敏打印机发送 ESC/POS 指令...');
      print('[Flutter Print] 打印工单: ${data.orderNo}, SKU: ${data.skuName}, 数量: ${data.rollsCount} 卷');
    }

    // 模拟 250ms 静默秒级打印
    await Future.delayed(const Duration(milliseconds: 250));
    return true;
  }
}
