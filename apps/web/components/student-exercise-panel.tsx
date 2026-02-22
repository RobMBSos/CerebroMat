'use client';

import { useEffect, useMemo, useState } from 'react';
import { evaluateSpeedTip } from '@cerebromat/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

type AgeGroup = 'INFANT_3_5' | 'AGE_6_7' | 'AGE_8_9' | 'AGE_10_12';
type Mode = 'OPERATIONS' | 'WORD_PROBLEMS' | 'MIXED';
type Category = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'WORD_PROBLEM';
type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD';
type PromptLayout = 'INLINE' | 'STACKED';

type GeneratedExercise = {
  category: Category;
  prompt: string;
  expectedAnswer: string;
  operands: number[];
  metadata?: Record<string, unknown>;
};

type HistoryBaselineResponse = {
  byCategory: Array<{
    category: Category;
    avgResponseMs: number;
  }>;
};

const layoutOptions: Array<{ label: string; value: PromptLayout }> = [
  { label: 'En línea', value: 'INLINE' },
  { label: 'Vertical', value: 'STACKED' },
];

const difficultyOptions: Array<{ label: string; value: DifficultyLevel }> = [
  { label: 'Fácil', value: 'EASY' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Difícil', value: 'HARD' },
];

const sessionSizeOptions = [10, 20, 30, 40, 50] as const;

function isOperationCategory(category: Category): boolean {
  return category !== 'WORD_PROBLEM';
}

function getOperatorSymbol(category: Category): string {
  if (category === 'ADDITION') return '+';
  if (category === 'SUBTRACTION') return '-';
  if (category === 'MULTIPLICATION') return '×';
  if (category === 'DIVISION') return '÷';
  return '';
}

function shouldUseStackedLayout(layout: PromptLayout): boolean {
  return layout === 'STACKED';
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

const ageOptions: Array<{ label: string; value: AgeGroup }> = [
  { label: '3-5', value: 'INFANT_3_5' },
  { label: '6-7', value: 'AGE_6_7' },
  { label: '8-9', value: 'AGE_8_9' },
  { label: '10-12', value: 'AGE_10_12' },
];

const modeOptions: Array<{ label: string; value: Mode }> = [
  { label: 'Operaciones', value: 'OPERATIONS' },
  { label: 'Problemas', value: 'WORD_PROBLEMS' },
  { label: 'Mixto', value: 'MIXED' },
];

const categoryOptions: Array<{ label: string; value: Category }> = [
  { label: 'Suma', value: 'ADDITION' },
  { label: 'Resta', value: 'SUBTRACTION' },
  { label: 'Multiplicación', value: 'MULTIPLICATION' },
  { label: 'División', value: 'DIVISION' },
  { label: 'Problemas', value: 'WORD_PROBLEM' },
];

type StudentExercisePanelProps = {
  assignmentId?: string;
  assignmentTitle?: string;
  onAssignmentComplete?: () => void;
};

export function StudentExercisePanel({
  assignmentId,
  assignmentTitle,
  onAssignmentComplete,
}: StudentExercisePanelProps = {}) {
  const { session } = useAuth();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_8_9');
  const [mode, setMode] = useState<Mode>('MIXED');
  const [categories, setCategories] = useState<Category[]>(['ADDITION', 'SUBTRACTION', 'WORD_PROBLEM']);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('NORMAL');
  const [promptLayout, setPromptLayout] = useState<PromptLayout>('STACKED');
  const [totalExercises, setTotalExercises] = useState<number>(10);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState<Array<Record<string, unknown>>>([]);
  const [questionStart, setQuestionStart] = useState<number>(Date.now());

  const [feedback, setFeedback] = useState<string | null>(null);
  const [speedTip, setSpeedTip] = useState<string | null>(null);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [isFinalAwaitingAdvance, setIsFinalAwaitingAdvance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ correct: number; total: number; avgMs: number } | null>(null);
  const [averageByCategoryMs, setAverageByCategoryMs] = useState<Partial<Record<Category, number>>>({});

  const current = useMemo(() => exercises[index], [exercises, index]);
  const shouldStackCurrentOperation =
    Boolean(current && isOperationCategory(current.category)) &&
    shouldUseStackedLayout(promptLayout);

  useEffect(() => {
    setCategories((prev) => {
      const selectedOperations: Category[] = prev.filter(
        (item) => item !== 'WORD_PROBLEM',
      );
      const safeOperations: Category[] =
        selectedOperations.length > 0 ? selectedOperations : ['ADDITION'];

      if (mode === 'WORD_PROBLEMS') {
        return ['WORD_PROBLEM'];
      }

      if (mode === 'OPERATIONS') {
        return safeOperations;
      }

      return [...safeOperations, 'WORD_PROBLEM'] as Category[];
    });
  }, [mode]);

  useEffect(() => {
    if (!session || session.user.role !== 'STUDENT') {
      return;
    }
    const studentId = session.user.id;

    async function loadCategoryBaseline() {
      try {
        const data = await apiRequest<HistoryBaselineResponse>(
          `/students/${studentId}/history?limit=200`,
          { auth: true },
        );

        const baseline = data.byCategory.reduce<Partial<Record<Category, number>>>(
          (acc, item) => {
            if (item.avgResponseMs > 0) {
              acc[item.category] = item.avgResponseMs;
            }
            return acc;
          },
          {},
        );

        setAverageByCategoryMs(baseline);
      } catch {
        setAverageByCategoryMs({});
      }
    }

    void loadCategoryBaseline();
  }, [session]);

  function toggleCategory(category: Category) {
    if (mode === 'WORD_PROBLEMS' || category === 'WORD_PROBLEM') {
      return;
    }

    setCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  }

  async function startSession() {
    setError(null);
    setSummary(null);

    try {
      let data: { session: { id: string }; exercises: GeneratedExercise[] };

      if (assignmentId) {
        // Start via assignment endpoint
        data = await apiRequest<{ session: { id: string }; exercises: GeneratedExercise[] }>(
          `/assignments/${assignmentId}/start`,
          { method: 'POST', auth: true },
        );
      } else {
        const operationSelection = categories.filter((item) => item !== 'WORD_PROBLEM');
        const safeOperations = operationSelection.length > 0 ? operationSelection : ['ADDITION'];
        const resolvedCategories =
          mode === 'WORD_PROBLEMS'
            ? ['WORD_PROBLEM']
            : mode === 'OPERATIONS'
              ? safeOperations
              : [...safeOperations, 'WORD_PROBLEM'];

        data = await apiRequest<{ session: { id: string }; exercises: GeneratedExercise[] }>(
          '/sessions/start',
          {
            method: 'POST',
            auth: true,
            body: {
              ageGroup,
              mode,
              categories: resolvedCategories.length > 0 ? resolvedCategories : ['ADDITION'],
              totalExercises,
              difficulty,
            },
          },
        );
      }

      setSessionId(data.session.id);
      setExercises(data.exercises);
      setIndex(0);
      setAnswer('');
      setAttempts([]);
      setQuestionStart(Date.now());
      setFeedback(null);
      setSpeedTip(null);
      setAwaitingAdvance(false);
      setIsFinalAwaitingAdvance(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la sesión');
    }
  }

  async function submitAnswer() {
    if (!current || !sessionId || saving || awaitingAdvance) {
      return;
    }

    if (!answer.trim()) {
      setError('Escribe una respuesta');
      return;
    }

    setError(null);
    const responseMs = Date.now() - questionStart;
    const isCorrect = answer.trim().toLowerCase() === current.expectedAnswer.trim().toLowerCase();

    const currentAttempt = {
      category: current.category,
      level: 1,
      prompt: current.prompt,
      operands: current.operands,
      expectedAnswer: current.expectedAnswer,
      studentAnswer: answer,
      isCorrect,
      responseMs,
      metadata: current.metadata,
    };

    const nextAttempts = [...attempts, currentAttempt];

    setAttempts(nextAttempts);
    setFeedback(isCorrect ? '¡Correcto!' : `No exacto. Respuesta esperada: ${current.expectedAnswer}`);
    const speedResult = evaluateSpeedTip({
      ageGroup,
      category: current.category,
      responseMs,
      categoryAverageMs: averageByCategoryMs[current.category],
    });

    setSpeedTip(
      speedResult.tip
        ? `${speedResult.tip} (Tardaste ${formatSeconds(responseMs)}; objetivo ${formatSeconds(speedResult.thresholdMs)}.)`
        : null,
    );
    setAverageByCategoryMs((prev) => {
      const previousAverage = prev[current.category];
      const nextAverage =
        typeof previousAverage === 'number' && previousAverage > 0
          ? Math.round(previousAverage * 0.8 + responseMs * 0.2)
          : responseMs;
      return {
        ...prev,
        [current.category]: nextAverage,
      };
    });
    setAnswer('');

    const isLastExercise = index + 1 >= exercises.length;
    setAwaitingAdvance(true);
    setIsFinalAwaitingAdvance(isLastExercise);
  }

  async function finishSession(finalAttempts: Array<Record<string, unknown>>) {
    if (!sessionId) {
      return;
    }

    setSaving(true);

    const total = finalAttempts.length;
    const correct = finalAttempts.filter((attempt) => attempt.isCorrect === true).length;
    const avgMs =
      total > 0
        ? Math.round(
            finalAttempts.reduce((acc, attempt) => acc + Number(attempt.responseMs ?? 0), 0) / total,
          )
        : 0;

    try {
      await apiRequest('/attempts/bulk', {
        method: 'POST',
        auth: true,
        body: {
          sessionId,
          attempts: finalAttempts,
        },
      });

      await apiRequest(`/sessions/${sessionId}/finish`, {
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
      setAwaitingAdvance(false);
      setIsFinalAwaitingAdvance(false);
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la sesión');
    } finally {
      setSaving(false);
    }
  }

  async function continueAfterFeedback() {
    if (!awaitingAdvance || saving) {
      return;
    }

    if (isFinalAwaitingAdvance) {
      await finishSession(attempts);
      return;
    }

    setIndex((prev) => prev + 1);
    setQuestionStart(Date.now());
    setFeedback(null);
    setSpeedTip(null);
    setAwaitingAdvance(false);
    setIsFinalAwaitingAdvance(false);
  }

  return (
    <Card className="border-cyan-200 bg-gradient-to-br from-[#ecfeff] to-white dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
      <CardHeader>
        <CardTitle className="text-2xl">
          {assignmentTitle ? `Tarea: ${assignmentTitle}` : 'Zona de Ejercicios'}
        </CardTitle>
        <CardDescription>
          {assignmentTitle
            ? 'Completa la tarea asignada por tu profesor.'
            : 'Elige edad, modo, categorías y tamaño de sesión.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!sessionId && assignmentId ? (
          <Button className="h-12 w-full text-base" onClick={() => void startSession()}>
            Empezar tarea
          </Button>
        ) : null}

        {!sessionId && !assignmentId ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edad</p>
              <div className="flex flex-wrap gap-2">
                {ageOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      ageGroup === option.value
                        ? 'bg-cyan-700 text-white dark:bg-cyan-500 dark:text-slate-950'
                        : 'bg-cyan-100 text-cyan-900 hover:bg-cyan-200 dark:bg-slate-800 dark:text-cyan-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setAgeGroup(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Modo</p>
              <div className="flex flex-wrap gap-2">
                {modeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      mode === option.value
                        ? 'bg-sky-700 text-white dark:bg-sky-500 dark:text-slate-950'
                        : 'bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-slate-800 dark:text-sky-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setMode(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Formato de operaciones</p>
              <div className="flex flex-wrap gap-2">
                {layoutOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      promptLayout === option.value
                        ? 'bg-indigo-700 text-white dark:bg-indigo-500 dark:text-slate-950'
                        : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 dark:bg-slate-800 dark:text-indigo-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setPromptLayout(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dificultad</p>
              <div className="flex flex-wrap gap-2">
                {difficultyOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      difficulty === option.value
                        ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-slate-800 dark:text-amber-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setDifficulty(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {mode === 'WORD_PROBLEMS' ? 'Categoría' : 'Operaciones'}
              </p>
              {mode === 'MIXED' ? (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  En modo mixto, problemas se incluyen automáticamente.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {mode === 'WORD_PROBLEMS' ? (
                  <span className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white dark:bg-teal-500 dark:text-slate-950">
                    Problemas
                  </span>
                ) : (
                  categoryOptions
                    .filter((option) => option.value !== 'WORD_PROBLEM')
                    .map((option) => (
                      <button
                        key={option.value}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                          categories.includes(option.value)
                            ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                            : 'bg-teal-100 text-teal-900 hover:bg-teal-200 dark:bg-slate-800 dark:text-teal-100 dark:hover:bg-slate-700'
                        }`}
                        onClick={() => toggleCategory(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Ejercicios por sesión
              </p>
              <div className="flex flex-wrap gap-2">
                {sessionSizeOptions.map((size) => (
                  <button
                    key={size}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      totalExercises === size
                        ? 'bg-violet-700 text-white dark:bg-violet-500 dark:text-slate-950'
                        : 'bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-slate-800 dark:text-violet-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setTotalExercises(size)}
                    type="button"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <Button className="h-12 w-full text-base" onClick={() => void startSession()}>
              Empezar sesión ({totalExercises} ejercicios)
            </Button>
          </>
        ) : null}

        {sessionId && current ? (
          <div className="space-y-4 rounded-2xl border border-cyan-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/80">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              Ejercicio {index + 1}/{exercises.length}
            </p>
            {shouldStackCurrentOperation ? (
              <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-600 dark:bg-slate-900">
                <p className="text-right text-4xl font-black leading-tight text-slate-900 dark:text-slate-100">{current.operands[0]}</p>
                <div className="flex items-end justify-end gap-2 text-right text-4xl font-black leading-tight text-slate-900 dark:text-slate-100">
                  <span>{getOperatorSymbol(current.category)}</span>
                  <span>{current.operands[1]}</span>
                </div>
                <div className="mt-2 h-1 w-full rounded bg-slate-900 dark:bg-slate-100" />
              </div>
            ) : (
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{current.prompt}</p>
            )}

            <Input
              className="h-14 text-2xl font-bold"
              readOnly={awaitingAdvance || saving}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (awaitingAdvance) {
                    void continueAfterFeedback();
                    return;
                  }
                  void submitAnswer();
                }
              }}
              placeholder="Tu respuesta"
              value={answer}
            />

            <Button
              className="h-12 w-full text-lg"
              disabled={saving}
              onClick={() => void (awaitingAdvance ? continueAfterFeedback() : submitAnswer())}
            >
              {awaitingAdvance
                ? isFinalAwaitingAdvance
                  ? 'Finalizar sesión (Enter)'
                  : 'Siguiente (Enter)'
                : 'Responder'}
            </Button>

            {feedback ? (
              <p
                className={`text-2xl font-black ${
                  feedback.includes('Correcto') ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {feedback}
              </p>
            ) : null}
            {speedTip ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{speedTip}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-lg font-black text-emerald-900 dark:text-emerald-200">Resumen de sesión</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">Aciertos: {summary.correct}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">Total: {summary.total}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Tiempo medio: {formatSeconds(summary.avgMs)}
            </p>
            {speedTip ? (
              <p className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                Último tip: {speedTip}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
