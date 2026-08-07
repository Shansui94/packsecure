import 'package:flutter/material.dart';
import '../core/services/print_service.dart';

class LabelPrintScreen extends StatefulWidget {
  const LabelPrintScreen({super.key});

  @override
  State<LabelPrintScreen> createState() => _LabelPrintScreenState();
}

class _LabelPrintScreenState extends State<LabelPrintScreen> {
  bool _isPrinting = false;
  String _status = "";

  void _printTest() async {
    setState(() {
      _isPrinting = true;
      _status = "正在向热敏打印机发送 ESC/POS 字节流...";
    });

    final label = LabelData(
      orderNo: "SO-FLUTTER-888",
      skuName: "Packsecure Premium Box 200",
      rollsCount: 100,
      operatorName: "Ameer",
      factoryName: "Nilai Main Factory",
    );

    final success = await GooglePrintService.printLabelSilent(label);

    setState(() {
      _isPrinting = false;
      _status = success ? "✅ 静默打印成功！(Flutter 驱动出单)" : "❌ 打印失败";
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: const Color(0xFF0F172A),
      child: Column(
        children: [
          Card(
            color: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("🖨️ 工厂标签静默打印引擎", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text("扫码一键硬连接静默秒级出单", style: TextStyle(color: Colors.grey, fontSize: 13)),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: _isPrinting ? null : _printTest,
                      child: _isPrinting
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text("一键测试: 扫码静默打印贴签", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  if (_status.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(_status, style: const TextStyle(color: Colors.lightBlueAccent, fontSize: 13)),
                  ]
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
