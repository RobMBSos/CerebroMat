'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';

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

const layoutOptions: Array<{ label: string; value: PromptLayout }> = [
  { label: 'Auto', value: 'AUTO' },
  { label: 'En línea', value: 'INLINE' },
  { label: 'Vertical', value: 'STACKED' },
];

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

function shouldUseStackedLayout(ageGroup: AgeGroup, layout: PromptLayout): boolean {
  if (layout === 'STACKED') {
    return true;
  }
  if (layout === 'INLINE') {
    return false;
  }

  // Auto: vertical por defecto para trabajo escolar infantil/primaria.
  return true;
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

export function StudentExercisePanel() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_8_9');
  const [mode, setMode] = useState<Mode>('MIXED');
  const [categories, setCategories] = useState<Category[]>(['ADDITION', 'SUBTRACTION', 'WORD_PROBLEM']);
  const [promptLayout, setPromptLayout] = useState<PromptLayout>('AUTO');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState<Array<Record<string, unknown>>>([]);
  const [questionStart, setQuestionStart] = useState<number>(Date.now());

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ correct: number; total: number; avgMs: number } | null>(null);

  const current = useMemo(() => exercises[index], [exercises, index]);
  const shouldStackCurrentOperation =
    Boolean(current && isOperationCategory(current.category)) &&
    shouldUseStackedLayout(ageGroup, promptLayout);

  function toggleCategory(category: Category) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  }

  async function startSession() {
    setError(null);
    setSummary(null);

    const resolvedCategories =
      mode === 'WORD_PROBLEMS'
        ? ['WORD_PROBLEM']
        : mode === 'OPERATIONS'
          ? categories.filter((item) => item !== 'WORD_PROBLEM')
          : categories;

    try {
      const data = await apiRequest<{ session: { id: string }; exercises: GeneratedExercise[] }>(
        '/sessions/start',
        {
          method: 'POST',
          auth: true,
          body: {
            ageGroup,
            mode,
            categories: resolvedCategories.length > 0 ? resolvedCategories : ['ADDITION'],
            totalExercises: 10,
          },
        },
      );

      setSessionId(data.session.id);
      setExercises(data.exercises);
      setIndex(0);
      setAnswer('');
      setAttempts([]);
      setQuestionStart(Date.now());
      setFeedback(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la sesión');
    }
  }

  async function submitAnswer() {
    if (!current || !sessionId || saving) {
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
    setAnswer('');

    if (index + 1 < exercises.length) {
      window.setTimeout(() => {
        setIndex((prev) => prev + 1);
        setQuestionStart(Date.now());
        setFeedback(null);
      }, 650);
      return;
    }

    await finishSession(nextAttempts);
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la sesión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-cyan-200 bg-gradient-to-br from-[#ecfeff] to-white dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
      <CardHeader>
        <CardTitle className="text-2xl">Zona de Ejercicios</CardTitle>
        <CardDescription>
          Elige edad, modo y categorías. Incluye operaciones y problemas con texto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!sessionId ? (
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
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Categorías</p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((option) => (
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
                ))}
              </div>
            </div>

            <Button className="h-12 w-full text-base" onClick={() => void startSession()}>
              Empezar sesión (10 ejercicios)
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
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Tu respuesta"
              value={answer}
            />

            <Button
              className="h-12 w-full text-lg"
              disabled={saving}
              onClick={() => void submitAnswer()}
            >
              Responder
            </Button>

            {feedback ? (
              <p
                className={`text-sm font-semibold ${
                  feedback.includes('Correcto') ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {feedback}
              </p>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-lg font-black text-emerald-900 dark:text-emerald-200">Resumen de sesión</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">Aciertos: {summary.correct}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">Total: {summary.total}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">Tiempo medio: {summary.avgMs} ms</p>
          </div>
        ) : null}

        {error ? <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
