import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { MiniBarChart } from '@/components/bar-chart';

type StudentItem = {
  id: string;
  fullName: string;
};

type AnalyticsResponse = {
  summary: {
    totalAttempts: number;
    overallAccuracy: number;
    averageResponseMs: number;
  };
  accuracySeries: { period: string; accuracy: number }[];
  timeSeries: { period: string; avgResponseMs: number }[];
  levelSeries: { period: string; avgLevel: number }[];
  currentSkills: { category: string; currentLevel: number }[];
};

export default function ProgressTab() {
  const { session, request } = useAuth();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }
    const activeSession = session as NonNullable<typeof session>;

    async function bootstrap() {
      try {
        if (activeSession.user.role === 'STUDENT') {
          setStudentId(activeSession.user.id);
          return;
        }

        const linked = await request<StudentItem[]>('/students', { auth: true });
        setStudents(linked);
        setStudentId(linked[0]?.id ?? null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar alumnos');
      }
    }

    void bootstrap();
  }, [request, session]);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    async function loadAnalytics() {
      try {
        setError(null);
        const data = await request<AnalyticsResponse>(
          `/analytics/student-series?studentId=${studentId}&granularity=day`,
          { auth: true },
        );
        setAnalytics(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar analítica');
      }
    }

    void loadAnalytics();
  }, [request, studentId]);

  const recentAccuracy = useMemo(
    () => (analytics ? analytics.accuracySeries.slice(-7).map((item) => Math.round(item.accuracy * 100)) : []),
    [analytics],
  );

  const recentTime = useMemo(
    () => (analytics ? analytics.timeSeries.slice(-7).map((item) => Math.round(item.avgResponseMs / 100)) : []),
    [analytics],
  );

  const recentLabels = useMemo(
    () => (analytics ? analytics.accuracySeries.slice(-7).map((item) => item.period.slice(5)) : []),
    [analytics],
  );

  if (!session) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a' }}>Progreso</Text>
          <Text style={{ color: '#334155' }}>Resumen de aciertos, tiempo medio y evolución de nivel.</Text>

          {session.user.role === 'PARENT' && students.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {students.map((student) => (
                <Pressable
                  key={student.id}
                  onPress={() => setStudentId(student.id)}
                  style={{
                    backgroundColor: studentId === student.id ? '#0f766e' : '#ccfbf1',
                    borderRadius: 14,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: studentId === student.id ? '#ffffff' : '#0f172a', fontWeight: '700' }}>
                    {student.fullName}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {analytics ? (
          <>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                Intentos: {analytics.summary.totalAttempts}
              </Text>
              <Text style={{ color: '#0f172a' }}>
                Precisión global: {Math.round(analytics.summary.overallAccuracy * 100)}%
              </Text>
              <Text style={{ color: '#0f172a' }}>Tiempo medio: {analytics.summary.averageResponseMs} ms</Text>
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Acierto (%)</Text>
              <MiniBarChart values={recentAccuracy} labels={recentLabels} color="#0f766e" />
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Tiempo (x100 ms)</Text>
              <MiniBarChart values={recentTime} labels={recentLabels} color="#0284c7" />
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Nivel actual</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {analytics.currentSkills?.map((skill) => (
                  <View key={skill.category} style={{ backgroundColor: '#ccfbf1', borderRadius: 12, padding: 8 }}>
                    <Text style={{ color: '#0f172a', fontWeight: '700' }}>
                      {skill.category}: {skill.currentLevel}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16 }}>
            <Text style={{ color: '#475569' }}>Sin datos de progreso todavía.</Text>
          </View>
        )}

        {error ? <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
