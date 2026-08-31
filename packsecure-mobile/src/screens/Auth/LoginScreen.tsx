import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../api/supabase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('错误', '请输入邮箱和密码');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('登录失败', error.message);
    } else {
      onLoginSuccess();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Packsecure OS</Text>
      <Text style={styles.subtitle}>司机与操作员终端</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="邮箱 (Email)"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="密码 (Password)"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={styles.loginBtn} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginBtnText}>登 录</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 24 },
  title: { color: '#f8fafc', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#38bdf8', fontSize: 16, textAlign: 'center', marginBottom: 48 },
  form: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12 },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  loginBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  loginBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});
