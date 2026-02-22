import { useEffect, useMemo, useState } from 'react';
import { getSpeedTipForCategory } from '@cerebromat/shared';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppFooter } from '@/components/app-footer';
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

type StudentHistoryResponse = {
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    accuracy: number;
    averageResponseMs: number;
  };
  byCategory: {
    category: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    avgResponseMs: number;
  }[];
  attempts: {
    id: string;
    category: string;
    level: number;
    prompt: string;
    expectedAnswer: string;
    studentAnswer: string;
    isCorrect: boolean;
    responseMs: number;
    answeredAt: string;
  }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  ADDITION: 'Suma',
  SUBTRACTION: 'Resta',
  MULTIPLICATION: 'Multiplicación',
  DIVISION: 'División',
  WORD_PROBLEM: 'Problemas',
};

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ProgressTab() {
  const { session, request } = useAuth();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [history, setHistory] = useState<StudentHistoryResponse | null>(null);
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
        const [analyticsData, historyData] = await Promise.all([
          request<AnalyticsResponse>(`/analytics/student-series?studentId=${studentId}&granularity=day`, {
            auth: true,
          }),
          request<StudentHistoryResponse>(`/students/${studentId}/history?limit=40`, {
            auth: true,
          }),
        ]);
        setAnalytics(analyticsData);
        setHistory(historyData);
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
    () =>
      analytics
        ? analytics.timeSeries
            .slice(-7)
            .map((item) => Number((item.avgResponseMs / 1000).toFixed(1)))
        : [],
    [analytics],
  );

  const recentLabels = useMemo(
    () => (analytics ? analytics.accuracySeries.slice(-7).map((item) => item.period.slice(5)) : []),
    [analytics],
  );

  const weakestCategories = useMemo(
    () =>
      [...(history?.byCategory ?? [])]
        .sort((left, right) => {
          if (right.incorrect !== left.incorrect) {
            return right.incorrect - left.incorrect;
          }
          return right.attempts - left.attempts;
        })
        .slice(0, 3),
    [history],
  );

  const specialHelp = useMemo(
    () =>
      weakestCategories
        .filter((item) => item.incorrect > 0)
        .map((item) => ({
          ...item,
          tip: getSpeedTipForCategory(item.category),
        })),
    [weakestCategories],
  );

  const recentAttempts = useMemo(() => (history ? history.attempts.slice(0, 12) : []), [history]);

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
              <Text style={{ color: '#0f172a' }}>
                Tiempo medio: {formatSeconds(analytics.summary.averageResponseMs)}
              </Text>
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Acierto (%)</Text>
              <MiniBarChart values={recentAccuracy} labels={recentLabels} color="#0f766e" />
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Tiempo (s)</Text>
              <MiniBarChart values={recentTime} labels={recentLabels} color="#0284c7" />
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Áreas a reforzar</Text>
              {weakestCategories.length > 0 ? (
                weakestCategories.map((item) => (
                  <View
                    key={item.category}
                    style={{
                      backgroundColor: '#fef3c7',
                      borderColor: '#fcd34d',
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: '#92400e', fontWeight: '800' }}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Text>
                    <Text style={{ color: '#92400e', fontSize: 12 }}>
                      Fallos: {item.incorrect} / {item.attempts} · Precisión: {Math.round(item.accuracy * 100)}%
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#475569' }}>Todavía no hay datos suficientes.</Text>
              )}
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Ayuda especial</Text>
              <Text style={{ color: '#334155', fontSize: 13 }}>
                Consejos concretos según en qué está fallando más.
              </Text>
              {specialHelp.length > 0 ? (
                specialHelp.map((item) => (
                  <View
                    key={`tip-${item.category}`}
                    style={{
                      backgroundColor: '#ecfeff',
                      borderColor: '#67e8f9',
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      gap: 5,
                    }}
                  >
                    <Text style={{ color: '#155e75', fontWeight: '800' }}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Text>
                    <Text style={{ color: '#164e63', fontSize: 12 }}>
                      Fallos recientes: {item.incorrect} / {item.attempts}
                    </Text>
                    <Text style={{ color: '#0e7490', fontSize: 13, fontWeight: '700' }}>{item.tip}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#475569' }}>
                  Sin fallos relevantes en este rango. Muy bien.
                </Text>
              )}
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Nivel actual</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {analytics.currentSkills?.map((skill) => (
                  <View key={skill.category} style={{ backgroundColor: '#ccfbf1', borderRadius: 12, padding: 8 }}>
                    <Text style={{ color: '#0f172a', fontWeight: '700' }}>
                      {CATEGORY_LABELS[skill.category] ?? skill.category}: {skill.currentLevel}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Historial reciente</Text>
              {recentAttempts.length > 0 ? (
                recentAttempts.map((attempt) => (
                  <View
                    key={attempt.id}
                    style={{
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 12,
                      padding: 10,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: '#0f172a', fontWeight: '800', flexShrink: 1 }}>
                        {CATEGORY_LABELS[attempt.category] ?? attempt.category}
                      </Text>
                      <Text style={{ color: attempt.isCorrect ? '#166534' : '#b91c1c', fontWeight: '800' }}>
                        {attempt.isCorrect ? 'Correcto' : 'Fallo'}
                      </Text>
                    </View>
                    <Text style={{ color: '#334155' }}>{attempt.prompt}</Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                      Alumno: {attempt.studentAnswer} · Correcta: {attempt.expectedAnswer} ·{' '}
                      {formatSeconds(attempt.responseMs)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#475569' }}>Sin intentos recientes.</Text>
              )}
            </View>
          </>
        ) : (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16 }}>
            <Text style={{ color: '#475569' }}>Sin datos de progreso todavía.</Text>
          </View>
        )}

        {error ? <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text> : null}
        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
