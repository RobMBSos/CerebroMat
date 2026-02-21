import { useState } from 'react';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('student@demo.local');
  const [password, setPassword] = useState('Demo12345!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ecfeff', padding: 20, justifyContent: 'center' }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>CerebroMat</Text>
        <Text style={{ color: '#334155', textAlign: 'center' }}>Entrar como alumno o padre/madre</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email"
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: '#94a3b8', borderRadius: 12, padding: 12 }}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: '#94a3b8', borderRadius: 12, padding: 12 }}
        />
        {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
        <Pressable
          onPress={onLogin}
          style={{ backgroundColor: '#0f766e', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700' }}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </Pressable>
        <Text style={{ fontSize: 12, color: '#475569' }}>Demo: student@demo.local / Demo12345!</Text>
      </View>
    </SafeAreaView>
  );
}
