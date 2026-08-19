import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 配置前台收到通知时的系统弹窗行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * 注册系统通知权限并获取 FCM 推送 Token
   */
  registerForPushNotifications: async (): Promise<string | null> => {
    let token: string | null = null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[FCM Notification] 用户拒绝了系统通知权限');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('[FCM Notification] 成功获取原生 Push Token:', token);
    } catch (err) {
      console.error('[FCM Notification] 获取 Push Token 失败:', err);
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('high_priority', {
        name: 'Packsecure 紧急派单与警报',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ef4444',
      });
    }

    return token;
  },

  /**
   * 发送本地高优先级测试通知
   */
  sendLocalUrgentAlert: async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // 立即发送
    });
  }
};
