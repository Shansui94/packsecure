import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const StorageService = {
  /**
   * 初始化本地 SQLite 数据库与表结构
   */
  initDatabase: async () => {
    try {
      db = await SQLite.openDatabaseAsync('packsecure_offline.db');
      
      // 创建离线考勤打卡表
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_attendances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          synced INTEGER DEFAULT 0
        );
      `);

      // 创建离线 POD 拍单签收表
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_pods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT NOT NULL,
          order_id TEXT NOT NULL,
          photo_uri TEXT NOT NULL,
          receiver_name TEXT,
          timestamp TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);

      console.log('[Offline Storage] SQLite 本地加密离线数据库初始化完成');
    } catch (err) {
      console.error('[Offline Storage] 数据库初始化失败:', err);
    }
  },

  /**
   * 无网状态下缓存考勤打卡
   */
  saveOfflineAttendance: async (userId: string, userName: string, type: 'CLOCK_IN' | 'CLOCK_OUT', lat?: number, lng?: number) => {
    if (!db) await StorageService.initDatabase();
    await db?.runAsync(
      'INSERT INTO offline_attendances (user_id, user_name, type, timestamp, latitude, longitude, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [userId, userName, type, new Date().toISOString(), lat || 0, lng || 0]
    );
    console.log('[Offline Storage] 考勤记录已安全保存在本地 SQLite 中');
  },

  /**
   * 获取未同步到云端的离线记录数
   */
  getUnsyncedCount: async (): Promise<{ attendanceCount: number; podCount: number }> => {
    if (!db) await StorageService.initDatabase();
    const attResult = await db?.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM offline_attendances WHERE synced = 0');
    const podResult = await db?.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM offline_pods WHERE synced = 0');
    return {
      attendanceCount: attResult?.count || 0,
      podCount: podResult?.count || 0
    };
  }
};
