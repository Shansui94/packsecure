import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { StorageService } from '../../services/storageService';

export const AttendanceScreen: React.FC = () => {
  const [unsynced, setUnsynced] = useState({ attendanceCount: 0, podCount: 0 });

  useEffect(() => {
    loadUnsynced();
  }, []);

  const loadUnsynced = async () => {
    const counts = await StorageService.getUnsyncedCount();
    setUnsynced(counts);
  };

  const handleClockIn = async () => {
    await StorageService.saveOfflineAttendance('EMP-001', 'Operator Ameer', 'CLOCK_IN');
    Alert.alert('打卡成功', '考勤已打卡。由于处于离线/厂区模式，打卡记录已安全保存在手机本地 SQLite 中。');
    loadUnsynced();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>⏱️ 厂区考勤打卡 (Kiosk模式准备)</Text>
        <Text style={styles.subtitle}>支持 NFC 刷卡 / 扫码 / 离线无网打卡</Text>

        <TouchableOpacity style={styles.clockBtn} onPress={handleClockIn}>
          <Text style={styles.clockBtnText}>上班打卡 (CLOCK IN)</Text>
        </TouchableOpacity>

        <View style={styles.offlineBox}>
          <Text style={styles.offlineTitle}>本地 SQLite 暂存状态:</Text>
          <Text style={styles.offlineCount}>未同步打卡记录: {unsynced.attendanceCount} 条</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  clockBtn: { backgroundColor: '#8b5cf6', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  clockBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  offlineBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8 },
  offlineTitle: { color: '#94a3b8', fontSize: 12 },
  offlineCount: { color: '#f59e0b', fontWeight: 'bold', marginTop: 4 }
});
