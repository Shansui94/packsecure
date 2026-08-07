import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { StorageService } from './src/services/storageService';
import { NotificationService } from './src/services/notificationService';
import { DriverHomeScreen } from './src/screens/Driver/DriverHomeScreen';
import { LabelPrintScreen } from './src/screens/Printing/LabelPrintScreen';
import { AttendanceScreen } from './src/screens/Attendance/AttendanceScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'DRIVER' | 'PRINT' | 'ATTENDANCE'>('DRIVER');

  useEffect(() => {
    // 启动时初始化 SQLite 与 FCM 通知注册
    StorageService.initDatabase();
    NotificationService.registerForPushNotifications();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* 顶部导航 Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Packsecure OS Mobile</Text>
        <Text style={styles.headerSubtitle}>原生微 App 引擎 v1.0.0</Text>
      </View>

      {/* 模块切换 Tab */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'DRIVER' && styles.activeTab]}
          onPress={() => setActiveTab('DRIVER')}
        >
          <Text style={[styles.tabText, activeTab === 'DRIVER' && styles.activeTabText]}>🚚 司机送货</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'PRINT' && styles.activeTab]}
          onPress={() => setActiveTab('PRINT')}
        >
          <Text style={[styles.tabText, activeTab === 'PRINT' && styles.activeTabText]}>🖨️ 贴签打印</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'ATTENDANCE' && styles.activeTab]}
          onPress={() => setActiveTab('ATTENDANCE')}
        >
          <Text style={[styles.tabText, activeTab === 'ATTENDANCE' && styles.activeTabText]}>⏱️ 考勤打卡</Text>
        </TouchableOpacity>
      </View>

      {/* 视图展现 */}
      <View style={styles.content}>
        {activeTab === 'DRIVER' && <DriverHomeScreen />}
        {activeTab === 'PRINT' && <LabelPrintScreen />}
        {activeTab === 'ATTENDANCE' && <AttendanceScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#38bdf8', fontSize: 12, marginTop: 2 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 6 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#334155' },
  tabText: { color: '#94a3b8', fontSize: 13 },
  activeTabText: { color: '#38bdf8', fontWeight: 'bold' },
  content: { flex: 1 }
});
