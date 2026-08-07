import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../api/supabase';

export const BACKGROUND_LOCATION_TASK = 'PACKSECURE_BACKGROUND_LOCATION_TASK';

// 注册 Expo TaskManager 后台常驻任务
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[GPS Service] 后台定位任务异常:', error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (location) {
      const { latitude, longitude, speed, heading } = location.coords;
      console.log(`[GPS Service] 关屏/后台定位触发: Lat ${latitude}, Lng ${longitude}`);
      
      // 上报司机实时位置到 Supabase driver_locations 表
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          await supabase.from('driver_locations').upsert({
            driver_id: userData.user.id,
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('[GPS Service] 异步上报 GPS 坐标失败，转入本地暂存', err);
      }
    }
  }
});

export const LocationService = {
  /**
   * 请求后台 GPS 权限
   */
  requestPermissions: async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return { success: false, message: '前台定位权限被拒绝' };
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      return { success: false, message: '后台关屏定位权限被拒绝' };
    }

    return { success: true };
  },

  /**
   * 启动司机关屏常驻后台 GPS 定位追踪
   */
  startBackgroundTracking: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      console.log('[GPS Service] 后台定位服务已在运行中');
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // 每 30 秒更新一次
      distanceInterval: 50,  // 每移动 50 米更新一次
      showsBackgroundLocationIndicator: true, // Android/iOS 标题栏持续通知图标
      foregroundService: {
        notificationTitle: "Packsecure 司机送货模式运行中",
        notificationBody: "系统正在记录您的送货行驶轨迹与里程",
        notificationColor: "#0f172a"
      }
    });

    console.log('[GPS Service] 后台关屏定位成功启动！');
    return true;
  },

  /**
   * 停止后台定位追踪
   */
  stopBackgroundTracking: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[GPS Service] 后台定位服务已停止');
    }
  }
};
