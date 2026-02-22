import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { AppFooter } from '@/components/app-footer';
import { useAuth } from '@/lib/auth';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  PARENT: 'Padre/Madre',
  STUDENT: 'Alumno',
};

export default function ProfileTab() {
  const { session, logout, request } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return null;
  }

  const canJoin = session.user.role === 'STUDENT' || session.user.role === 'PARENT';

  async function joinWithCode() {
    if (!inviteCode.trim()) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const result = await request<{ className: string; inviteType: string }>('/classes/join', {
        method: 'POST',
        auth: true,
        body: { code: inviteCode.trim() },
      });

      setMessage(`Unido correctamente a ${result.className} (${result.inviteType})`);
      setInviteCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo usar el código');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#0f172a' }}>Perfil</Text>
          <Text style={{ color: '#0f172a', fontWeight: '700' }}>{session.user.fullName}</Text>
          <Text style={{ color: '#334155' }}>{session.user.email}</Text>
          <Text style={{ color: '#334155' }}>
            Rol: {ROLE_LABELS[session.user.role] ?? session.user.role}
          </Text>
        </View>

        {canJoin ? (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Código de invitación</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="Ej: STU3A2026"
              style={{ borderWidth: 1, borderColor: '#94a3b8', borderRadius: 12, padding: 12 }}
            />
            <Pressable
              onPress={joinWithCode}
              style={{ backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>Unirme con código</Text>
            </Pressable>
            {message ? <Text style={{ color: '#166534', fontWeight: '700' }}>{message}</Text> : null}
            {error ? <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text> : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => void logout()}
          style={{ backgroundColor: '#b91c1c', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '800' }}>Cerrar sesión</Text>
        </Pressable>

        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
