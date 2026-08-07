import 'package:flutter/material.dart';
import '../core/services/location_service.dart';

class DriverScreen extends StatefulWidget {
  const DriverScreen({super.key});

  @override
  State<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
  bool _isTracking = false;
  String _locationStatus = "等待开始送货行程";

  void _toggleTracking() async {
    if (!_isTracking) {
      await GoogleLocationService.startBackgroundTracking((position) {
        setState(() {
          _locationStatus = "维度: ${position.latitude.toStringAsFixed(4)}, 经度: ${position.longitude.toStringAsFixed(4)}";
        });
      });
      setState(() {
        _isTracking = true;
      });
    } else {
      await GoogleLocationService.stopBackgroundTracking();
      setState(() {
        _isTracking = false;
        _locationStatus = "定位已停止";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: const Color(0xFF0F172A),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            color: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("🚚 司机送货行程: TRIP-2026-FLUTTER", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text("谷歌原生路线引擎与后台 GPS", style: TextStyle(color: Colors.blueGrey, fontSize: 14)),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text("GPS 状态:", style: TextStyle(color: Colors.grey)),
                        Text(_isTracking ? "● 关屏常驻追踪中" : "○ 已停止", style: TextStyle(color: _isTracking ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(_locationStatus, style: const TextStyle(color: Colors.cyan, fontSize: 12)),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isTracking ? Colors.red : Colors.blue,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: _toggleTracking,
                      child: Text(_isTracking ? "停止送货轨迹追踪" : "开启谷歌后台关屏 GPS", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
