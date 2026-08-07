import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { LocationService } from '../../services/locationService';

export const DriverHomeScreen: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTripNo, setCurrentTripNo] = useState('TRIP-2026-0804-01');

  const handleToggleTracking = async () => {
    if (!isTracking) {
      const permRes = await LocationService.requestPermissions();
      if (!permRes.success) {
        Alert.alert('权限未开通', permRes.message);
        return;
      }
      await LocationService.startBackgroundTracking();
      setIsTracking(true);
      Alert.alert('关屏轨迹追踪开启', '后台 GPS 定位成功运行，锁屏下也会持续上报送货里程。');
    } else {
      await LocationService.stopBackgroundTracking();
      setIsTracking(false);
      Alert.alert('定位停止', '司机送货行程已结束。');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚚 当前送货任务: {currentTripNo}</Text>
        <Text style={styles.cardSubtitle}>目的地: 工厂 A 仓库 (Batu Pahat)</Text>
        
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>后台关屏 GPS 状态:</Text>
          <Text style={[styles.statusValue, { color: isTracking ? '#22c55e' : '#ef4444' }]}>
            {isTracking ? '● 关屏常驻追踪中' : '○ 已停止'}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: isTracking ? '#ef4444' : '#2563eb' }]}
          onPress={handleToggleTracking}
        >
          <Text style={styles.btnText}>
            {isTracking ? '停止送货轨迹追踪' : '开启关屏常驻后台 GPS'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📷 离线签收单 POD 拍摄</Text>
        <Text style={styles.descText}>支持偏远无信号区域本地加密拍摄，恢复网络后静默自动上传。</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => Alert.alert('相机准备', '启动相机拍照签收单')}>
          <Text style={styles.outlineBtnText}>拍摄电子送货凭证 (POD)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  cardSubtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 12 },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12, backgroundColor: '#0f172a', padding: 12, borderRadius: 8 },
  statusLabel: { color: '#94a3b8' },
  statusValue: { fontWeight: 'bold' },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  descText: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  outlineBtn: { borderWidth: 1, borderColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  outlineBtnText: { color: '#3b82f6', fontWeight: 'bold' }
});
