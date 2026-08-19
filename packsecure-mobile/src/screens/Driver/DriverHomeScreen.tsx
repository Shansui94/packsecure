import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { LocationService } from '../../services/locationService';

export const DriverHomeScreen: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTripNo, setCurrentTripNo] = useState('TRIP-2026-0804-01');
  const [driverPos, setDriverPos] = useState({ lat: 1.8548, lng: 102.9325 }); // 模拟 Batu Pahat/Johor 坐标

  const handleToggleTracking = async () => {
    if (!isTracking) {
      const permRes = await LocationService.requestPermissions();
      if (!permRes.success) {
        Alert.alert('权限未开通', permRes.message);
        return;
      }
      await LocationService.startBackgroundTracking();
      setIsTracking(true);
      Alert.alert('关屏轨迹追踪开启', '后台 GPS 定位成功运行，实时送货地图开启。');
    } else {
      await LocationService.stopBackgroundTracking();
      setIsTracking(false);
      Alert.alert('定位停止', '司机送货行程已结束。');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 实时送货地图看板卡片 */}
      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>🗺️ 实时送货 GPS 地图导航</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{isTracking ? '● LIVE 定位中' : '○ 静态模式'}</Text>
          </View>
        </View>

        {/* 动态可视化地图图层卡片 */}
        <View style={styles.mapViewport}>
          {/* 模拟道路与网格背景 */}
          <View style={styles.gridOverlay} />
          
          {/* 路线描边画线 */}
          <View style={styles.routeLine} />
          
          {/* 起点标志 */}
          <View style={[styles.markerPin, styles.startPin]}>
            <Text style={styles.pinText}>🏭 工厂</Text>
          </View>

          {/* 司机车辆实时 Marker */}
          <View style={[styles.markerPin, styles.vehiclePin]}>
            <Text style={styles.vehicleEmoji}>🚚</Text>
            <View style={styles.pulseRing} />
          </View>

          {/* 终点客户标志 */}
          <View style={[styles.markerPin, styles.endPin]}>
            <Text style={styles.pinText}>📦 客户 A 厂</Text>
          </View>

          {/* 地图图例浮层 */}
          <View style={styles.mapOverlayBox}>
            <Text style={styles.mapOverlayText}>
              当前坐标: {driverPos.lat.toFixed(4)}, {driverPos.lng.toFixed(4)}
            </Text>
            <Text style={styles.mapOverlaySub}>目的地: Batu Pahat Industrial Area</Text>
          </View>
        </View>
      </View>

      {/* 任务行程卡片 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚚 当前送货任务: {currentTripNo}</Text>
        <Text style={styles.cardSubtitle}>运单包含: 50 卷 Heavy Duty Packaging Roll</Text>

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
            {isTracking ? '结束当前送货行程' : '开启地图 & 后台关屏 GPS 追踪'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* POD 拍单电子凭证 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📷 离线 POD 电子送货凭证</Text>
        <Text style={styles.descText}>支持无网无信号区域拍摄签收单，恢复网络后自动同步。</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => Alert.alert('相机准备', '启动相机拍摄 POD')}>
          <Text style={styles.outlineBtnText}>拍照上传 POD 签收单</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  mapCard: { backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#0f172a' },
  mapTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  liveBadge: { backgroundColor: '#064e3b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveBadgeText: { color: '#34d399', fontSize: 11, fontWeight: 'bold' },
  mapViewport: { height: 210, backgroundColor: '#111827', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  gridOverlay: { position: 'absolute', width: '100%', height: '100%', opacity: 0.15, borderWidth: 1, borderColor: '#38bdf8' },
  routeLine: { position: 'absolute', width: '70%', height: 4, backgroundColor: '#3b82f6', borderRadius: 2, transform: [{ rotate: '-15deg' }] },
  markerPin: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  startPin: { left: 20, top: 40, backgroundColor: '#1e3a8a' },
  endPin: { right: 20, bottom: 40, backgroundColor: '#065f46' },
  vehiclePin: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 20, elevation: 4 },
  vehicleEmoji: { fontSize: 20 },
  pulseRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#60a5fa', opacity: 0.6, top: -2, left: -2 },
  pinText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  mapOverlayBox: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 8, borderRadius: 6 },
  mapOverlayText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  mapOverlaySub: { color: '#94a3b8', fontSize: 11 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8, backgroundColor: '#0f172a', padding: 10, borderRadius: 8 },
  statusLabel: { color: '#94a3b8', fontSize: 13 },
  statusValue: { fontWeight: 'bold', fontSize: 13 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  descText: { color: '#64748b', fontSize: 12, marginBottom: 10 },
  outlineBtn: { borderWidth: 1, borderColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  outlineBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 }
});
