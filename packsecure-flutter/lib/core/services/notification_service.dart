import 'package:flutter/foundation.dart';

/// 谷歌官方 Firebase Cloud Messaging (FCM) 推送服务
class GoogleNotificationService {
  /// 初始化 FCM 服务并获取 Push Token
  static Future<String?> initializeFCM() async {
    if (kDebugMode) {
      print('[Firebase FCM] 正在注册 Firebase 原生消息推送通道...');
    }

    // 模拟获取到的 FCM 平台代币
    const String mockFcmToken = "fcm_token_google_stack_packsecure_2026";
    if (kDebugMode) {
      print('[Firebase FCM] 原生推送 Token 注册成功: $mockFcmToken');
    }

    return mockFcmToken;
  }
}
