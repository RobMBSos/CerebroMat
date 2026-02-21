import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';

type AgeGroup = 'INFANT_3_5' | 'AGE_6_7' | 'AGE_8_9' | 'AGE_10_12';
type Mode = 'OPERATIONS' | 'WORD_PROBLEMS' | 'MIXED';
type Category = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'WORD_PROBLEM';
type PromptLayout = 'AUTO' | 'INLINE' | 'STACKED';

type GeneratedExercise = {
  category: Category;
  prompt: string;
  expectedAnswer: string;
  operands: number[];
  metadata?: Record<string, unknown>;
};

const AGE_OPTIONS: { label: string; value: AgeGroup }[] = [
  { label: '3-5', value: 'INFANT_3_5' },
  { label: '6-7', value: 'AGE_6_7' },
  { label: '8-9', value: 'AGE_8_9' },
  { label: '10-12', value: 'AGE_10_12' },
];

const MODE_OPTIONS: { label: string; value: Mode }[] = [
  { label: 'Operaciones', value: 'OPERATIONS' },
  { label: 'Problemas', value: 'WORD_PROBLEMS' },
  { label: 'Mixto', value: 'MIXED' },
];

const CATEGORY_OPTIONS: { label: string; value: Category }[] = [
  { label: 'Suma', value: 'ADDITION' },
  { label: 'Resta', value: 'SUBTRACTION' },
  { label: 'Multi', value: 'MULTIPLICATION' },
  { label: 'Divi', value: 'DIVISION' },
  { label: 'Problemas', value: 'WORD_PROBLEM' },
];

const LAYOUT_OPTIONS: { label: string; value: PromptLayout }[] = [
  { label: 'Auto', value: 'AUTO' },
  { label: 'En línea', value: 'INLINE' },
  { label: 'Vertical', value: 'STACKED' },
];

function isOperationCategory(category: Category): boolean {
  return category !== 'WORD_PROBLEM';
}

function operatorSymbol(category: Category): string {
  if (category === 'ADDITION') return '+';
  if (category === 'SUBTRACTION') return '-';
  if (category === 'MULTIPLICATION') return '×';
  if (category === 'DIVISION') return '÷';
  return '';
}

function shouldUseStackedLayout(ageGroup: AgeGroup, layout: PromptLayout): boolean {
  if (layout === 'STACKED') return true;
  if (layout === 'INLINE') return false;
  return true;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ExercisesTab() {
  const { session, request } = useAuth();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_8_9');
  const [mode, setMode] = useState<Mode>('MIXED');
  const [categories, setCategories] = useState<Category[]>(['ADDITION', 'SUBTRACTION', 'WORD_PROBLEM']);
  const [promptLayout, setPromptLayout] = useState<PromptLayout>('AUTO');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ correct: number; total: number; avgMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentExercise = useMemo(() => exercises[index], [exercises, index]);
  const showStackedOperation =
    Boolean(currentExercise && isOperationCategory(currentExercise.category)) &&
    shouldUseStackedLayout(ageGroup, promptLayout);

  if (!session) {
    return null;
  }

  const isStudent = session.user.role === 'STUDENT';

  async function startSession() {
    setError(null);
    setSummary(null);
    try {
      const payloadCategories =
        mode === 'WORD_PROBLEMS'
          ? ['WORD_PROBLEM']
          : mode === 'OPERATIONS'
            ? categories.filter((item) => item !== 'WORD_PROBLEM')
            : categories;

      const data = await request<{ session: { id: string }; exercises: GeneratedExercise[] }>('/sessions/start', {
        method: 'POST',
        auth: true,
        body: {
          ageGroup,
          mode,
          categories: payloadCategories.length > 0 ? payloadCategories : ['ADDITION'],
          totalExercises: 10,
        },
      });

      setSessionId(data.session.id);
      setExercises(data.exercises);
      setIndex(0);
      setAnswer('');
      setAttempts([]);
      setQuestionStartedAt(Date.now());
      setFeedback(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesión');
    }
  }

  async function submitAnswer() {
    if (!currentExercise || !sessionId) {
      return;
    }

    if (!answer.trim()) {
      setError('Escribe una respuesta');
      return;
    }

    setError(null);
    const responseMs = Date.now() - questionStartedAt;
    const normalizedUser = answer.trim().toLowerCase();
    const normalizedExpected = currentExercise.expectedAnswer.trim().toLowerCase();
    const isCorrect = normalizedUser === normalizedExpected;

    const nextAttempts = [
      ...attempts,
      {
        category: currentExercise.category,
        level: 1,
        prompt: currentExercise.prompt,
        operands: currentExercise.operands,
        expectedAnswer: currentExercise.expectedAnswer,
        studentAnswer: answer,
        isCorrect,
        responseMs,
        metadata: currentExercise.metadata,
      },
    ];

    setAttempts(nextAttempts);
    setFeedback(isCorrect ? '¡Correcto!' : `Respuesta: ${currentExercise.expectedAnswer}`);
    setAnswer('');

    if (index + 1 < exercises.length) {
      setTimeout(() => {
        setIndex((prev) => prev + 1);
        setQuestionStartedAt(Date.now());
        setFeedback(null);
      }, 600);
      return;
    }

    await finishSession(nextAttempts);
  }

  async function finishSession(finalAttempts: any[]) {
    if (!sessionId) {
      return;
    }

    const total = finalAttempts.length;
    const correct = finalAttempts.filter((attempt) => attempt.isCorrect).length;
    const avgMs = total > 0 ? Math.round(finalAttempts.reduce((acc, attempt) => acc + attempt.responseMs, 0) / total) : 0;

    try {
      await request('/attempts/bulk', {
        method: 'POST',
        auth: true,
        body: {
          sessionId,
          attempts: finalAttempts,
        },
      });

      await request(`/sessions/${sessionId}/finish`, {
        method: 'POST',
        auth: true,
        body: {
          summary: {
            totalAttempts: total,
            correctAttempts: correct,
            averageResponseMs: avgMs,
          },
        },
      });

      setSummary({ correct, total, avgMs });
      setSessionId(null);
      setExercises([]);
      setIndex(0);
      setFeedback(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la sesión');
    }
  }

  function toggleCategory(category: Category) {
    if (categories.includes(category)) {
      setCategories((prev) => prev.filter((item) => item !== category));
      return;
    }

    setCategories((prev) => [...prev, category]);
  }

  if (!isStudent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff', padding: 16 }}>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a' }}>Modo Parent</Text>
          <Text style={{ marginTop: 8, color: '#334155' }}>
            Esta pestaña de ejercicios está habilitada para estudiantes. Usa Progreso para revisar resultados.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {!sessionId ? (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a' }}>Nueva sesión</Text>
            <Text style={{ color: '#334155' }}>Selecciona edad, modo y categorías (10 ejercicios)</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {AGE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setAgeGroup(option.value)}
                  style={{
                    backgroundColor: ageGroup === option.value ? '#0f766e' : '#dbeafe',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: ageGroup === option.value ? '#ffffff' : '#0f172a', fontWeight: '700' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MODE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setMode(option.value)}
                  style={{
                    backgroundColor: mode === option.value ? '#0284c7' : '#e0f2fe',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: mode === option.value ? '#ffffff' : '#0f172a', fontWeight: '700' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: '#334155', fontWeight: '700' }}>Formato de operaciones</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LAYOUT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPromptLayout(option.value)}
                  style={{
                    backgroundColor: promptLayout === option.value ? '#4338ca' : '#e0e7ff',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: promptLayout === option.value ? '#ffffff' : '#0f172a', fontWeight: '700' }}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => toggleCategory(option.value)}
                  style={{
                    backgroundColor: categories.includes(option.value) ? '#14b8a6' : '#ccfbf1',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '700' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={startSession}
              style={{ backgroundColor: '#0f766e', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>Empezar sesión</Text>
            </Pressable>
          </View>
        ) : null}

        {sessionId && currentExercise ? (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>
              Ejercicio {index + 1}/{exercises.length}
            </Text>
            {showStackedOperation ? (
              <View
                style={{
                  alignSelf: 'center',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  backgroundColor: '#f8fafc',
                  minWidth: 170,
                }}
              >
                <Text style={{ fontSize: 40, fontWeight: '900', color: '#0f172a', textAlign: 'right' }}>
                  {currentExercise.operands[0]}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 }}>
                  <Text style={{ fontSize: 40, fontWeight: '900', color: '#0f172a' }}>
                    {operatorSymbol(currentExercise.category)}
                  </Text>
                  <Text style={{ fontSize: 40, fontWeight: '900', color: '#0f172a' }}>
                    {currentExercise.operands[1]}
                  </Text>
                </View>
                <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: '#0f172a' }} />
              </View>
            ) : (
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#0f172a' }}>{currentExercise.prompt}</Text>
            )}
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              placeholder="Escribe tu respuesta"
              keyboardType="default"
              style={{ borderWidth: 1, borderColor: '#94a3b8', borderRadius: 14, padding: 14, fontSize: 20 }}
            />
            <Pressable
              onPress={submitAnswer}
              style={{ backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>Responder</Text>
            </Pressable>
            {feedback ? (
              <Text style={{ color: feedback.includes('Correcto') ? '#166534' : '#b91c1c', fontWeight: '700' }}>
                {feedback}
              </Text>
            ) : null}
          </View>
        ) : null}

        {summary ? (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>Resumen</Text>
            <Text style={{ color: '#0f172a' }}>Aciertos: {summary.correct}</Text>
            <Text style={{ color: '#0f172a' }}>Total: {summary.total}</Text>
            <Text style={{ color: '#0f172a' }}>Tiempo medio: {formatSeconds(summary.avgMs)}</Text>
          </View>
        ) : null}

        {error ? <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
