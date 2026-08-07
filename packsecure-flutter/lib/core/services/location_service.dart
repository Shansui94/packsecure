import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// 谷歌官方 Geolocator 常驻后台 GPS 轨迹服务
class GoogleLocationService {
  static StreamSubscription<Position>? _positionStreamSubscription;

  /// 检查并请求谷歌 GPS 权限
  static Future<bool> requestPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (kDebugMode) print('[Google GPS] 位置服务未开启');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  /// 启动司机关屏常驻后台 GPS 定位追踪
  static Future<void> startBackgroundTracking(Function(Position) onLocationChanged) async {
    final hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // 配置关屏与后台高精度定位策略
    const LocationSettings locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 30, // 移动 30 米触发一次
    );

    _positionStreamSubscription = Geolocator.getPositionStream(locationSettings: locationSettings)
        .listen((Position position) {
      if (kDebugMode) {
        print('[Google GPS] 实时轨迹更新: Lat ${position.latitude}, Lng ${position.longitude}, 速度: ${position.speed} m/s');
      }
      onLocationChanged(position);
    });

    if (kDebugMode) print('[Google GPS] 司机后台 GPS 定位服务开启成功！');
  }

  /// 停止定位追踪
  static Future<void> stopBackgroundTracking() async {
    await _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    if (kDebugMode) print('[Google GPS] 司机后台 GPS 定位服务已停止');
  }
}
