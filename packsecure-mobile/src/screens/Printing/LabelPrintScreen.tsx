import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { PrintService, PrintLabelData } from '../../services/printService';

export const LabelPrintScreen: React.FC = () => {
  const [printing, setPrinting] = useState(false);
  const [lastStatus, setLastStatus] = useState('');

  const handleSilentPrintTest = async () => {
    setPrinting(true);
    setLastStatus('正在发送 ESC/POS 指令给热敏打印机...');

    const sampleLabel: PrintLabelData = {
      orderNo: 'SO-20260804-88',
      skuName: 'Heavy Duty Box 300x200',
      cuttingSize: '350mm x 220mm',
      rollsCount: 50,
      operatorName: 'Ameer',
      factoryName: 'Nilai Main Factory',
      timestamp: new Date().toLocaleTimeString(),
    };

    const res = await PrintService.printMachineLabelSilent('00:11:22:33:44:55', sampleLabel);
    setPrinting(false);

    if (res.success) {
      setLastStatus(`✅ ${res.message} (${new Date().toLocaleTimeString()})`);
    } else {
      setLastStatus(`❌ ${res.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🖨️ 工厂标签静默打印引擎</Text>
        <Text style={styles.subtitle}>测试扫码无弹窗直接一键出单能力</Text>

        <TouchableOpacity 
          style={styles.printBtn} 
          onPress={handleSilentPrintTest}
          disabled={printing}
        >
          {printing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>扫码一键测试: 静默打印贴签</Text>
          )}
        </TouchableOpacity>

        {lastStatus ? <Text style={styles.statusText}>{lastStatus}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  printBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  statusText: { color: '#38bdf8', marginTop: 12, fontSize: 13, textAlign: 'center' }
});
