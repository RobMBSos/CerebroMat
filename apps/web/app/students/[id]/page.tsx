'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSpeedTipForCategory } from '@cerebromat/shared';
import { AppShell } from '@/components/app-shell';
import { StudentMetricsChart } from '@/components/charts/student-metrics-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

type StudentDetailResponse = {
  student: {
    id: string;
    fullName: string;
    email: string;
    studentProfile: { ageGroup: string; nickname?: string } | null;
    skills: Array<{ category: string; currentLevel: number }>;
  };
  metrics: {
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    avgResponseMs: number;
  };
};

type AnalyticsResponse = {
  summary: {
    totalAttempts: number;
    overallAccuracy: number;
    averageResponseMs: number;
  };
  accuracySeries: Array<{ period: string; accuracy: number }>;
  timeSeries: Array<{ period: string; avgResponseMs: number }>;
  levelSeries: Array<{ period: string; avgLevel: number }>;
};

type StudentHistoryResponse = {
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    accuracy: number;
    averageResponseMs: number;
  };
  byCategory: Array<{
    category: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    avgResponseMs: number;
  }>;
  attempts: Array<{
    id: string;
    category: string;
    level: number;
    prompt: string;
    expectedAnswer: string;
    studentAnswer: string;
    isCorrect: boolean;
    responseMs: number;
    answeredAt: string;
  }>;
};

type SessionAttempt = {
  id: string;
  category: string;
  level: number;
  prompt: string;
  expectedAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  responseMs: number;
  answeredAt: string;
};

type SessionEntry = {
  id: string;
  mode: string;
  difficulty: string;
  totalExercises: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  assignment: { id: string; title: string } | null;
  stats: { total: number; correct: number; accuracy: number; avgResponseMs: number };
  attempts: SessionAttempt[];
};

const CATEGORY_LABELS: Record<string, string> = {
  ADDITION: 'Suma',
  SUBTRACTION: 'Resta',
  MULTIPLICATION: 'Multiplicación',
  DIVISION: 'División',
  WORD_PROBLEM: 'Problemas',
};

const MODE_LABELS: Record<string, string> = {
  OPERATIONS: 'Operaciones',
  WORD_PROBLEMS: 'Problemas',
  MIXED: 'Mixto',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
};

function accuracyBorderColor(accuracy: number): string {
  if (accuracy >= 0.8) return 'border-l-emerald-500';
  if (accuracy >= 0.5) return 'border-l-amber-500';
  return 'border-l-rose-500';
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return 'En curso';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function toSeconds(ms: number): number {
  return Number((ms / 1000).toFixed(2));
}

export default function StudentDetailPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [history, setHistory] = useState<StudentHistoryResponse | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(() => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentId = useMemo(() => params.id, [params.id]);

  const toggleSession = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [detailData, analyticsData, historyData, sessionsData] = await Promise.all([
        apiRequest<StudentDetailResponse>(`/students/${studentId}`, { auth: true }),
        apiRequest<AnalyticsResponse>(
          `/analytics/student-series?studentId=${studentId}&from=${from}T00:00:00.000Z&to=${to}T23:59:59.000Z&granularity=day${
            category ? `&category=${category}` : ''
          }`,
          { auth: true },
        ),
        apiRequest<StudentHistoryResponse>(
          `/students/${studentId}/history?from=${from}T00:00:00.000Z&to=${to}T23:59:59.000Z&limit=80${
            category ? `&category=${category}` : ''
          }`,
          { auth: true },
        ),
        apiRequest<SessionEntry[]>(
          `/students/${studentId}/sessions?from=${from}T00:00:00.000Z&to=${to}T23:59:59.000Z&limit=20${
            category ? `&category=${category}` : ''
          }`,
          { auth: true },
        ),
      ]);

      setDetail(detailData);
      setAnalytics(analyticsData);
      setHistory(historyData);
      setSessions(sessionsData);
      setExpandedSessions(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el alumno');
    }
  }, [category, from, studentId, to]);

  useEffect(() => {
    if (!session || !studentId) {
      return;
    }

    void loadAll();
  }, [session, studentId, loadAll]);

  if (loading || !session) {
    return null;
  }

  const weakestCategories = [...(history?.byCategory ?? [])]
    .sort((left, right) => {
      if (right.incorrect !== left.incorrect) {
        return right.incorrect - left.incorrect;
      }
      return right.attempts - left.attempts;
    })
    .slice(0, 3);

  const specialHelp = weakestCategories
    .filter((item) => item.incorrect > 0)
    .map((item) => ({
      ...item,
      tip: getSpeedTipForCategory(item.category),
    }));

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Detalle de alumno</p>
          <p className="text-base font-black text-slate-800 dark:text-slate-100">
            {detail?.student.fullName ?? 'Alumno'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Atrás
          </Button>
          {session.user.role === 'STUDENT' ? (
            <Link href="/dashboard">
              <Button variant="ghost">Mi panel</Button>
            </Link>
          ) : (
            <>
              <Link href="/children">
                <Button variant="ghost">Alumnos</Button>
              </Link>
              {(session.user.role === 'TEACHER' || session.user.role === 'ADMIN') ? (
                <Link href="/classes">
                  <Button variant="ghost">Clases</Button>
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{detail?.metrics.totalAttempts ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acierto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {Math.round((detail?.metrics.accuracy ?? 0) * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo medio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {formatSeconds(detail?.metrics.avgResponseMs ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{detail?.student.studentProfile?.ageGroup ?? 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Filtros de analítica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={[
                { label: 'Todas categorías', value: '' },
                { label: 'Suma', value: 'ADDITION' },
                { label: 'Resta', value: 'SUBTRACTION' },
                { label: 'Multiplicación', value: 'MULTIPLICATION' },
                { label: 'División', value: 'DIVISION' },
                { label: 'Problemas', value: 'WORD_PROBLEM' },
              ]}
            />
            <Button onClick={() => void loadAll()}>Aplicar</Button>
          </div>
        </CardContent>
      </Card>

      {analytics ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <StudentMetricsChart
            title="Precisión"
            description="Aciertos por día"
            color="#0f766e"
            metric="accuracy"
            yDomain={[0, 1]}
            data={analytics.accuracySeries}
          />
          <StudentMetricsChart
            title="Tiempo"
            description="Segundos por intento"
            color="#0284c7"
            metric="avgResponseSeconds"
            data={analytics.timeSeries.map((item) => ({
              ...item,
              avgResponseSeconds: toSeconds(item.avgResponseMs),
            }))}
          />
          <StudentMetricsChart
            title="Nivel"
            description="Evolución de nivel"
            color="#0ea5e9"
            metric="avgLevel"
            data={analytics.levelSeries}
          />
        </div>
      ) : null}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Áreas a reforzar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {weakestCategories.length > 0 ? (
            weakestCategories.map((item) => (
              <div
                key={item.category}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </p>
                <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Fallos: {item.incorrect} / {item.attempts}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Precisión: {Math.round(item.accuracy * 100)}% · {formatSeconds(item.avgResponseMs)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No hay suficientes datos para detectar áreas de refuerzo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Ayuda especial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {specialHelp.length > 0 ? (
            specialHelp.map((item) => (
              <div
                key={`tip-${item.category}`}
                className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950/30"
              >
                <p className="text-sm font-black text-cyan-900 dark:text-cyan-200">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </p>
                <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  Fallos: {item.incorrect} / {item.attempts}
                </p>
                <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-200">{item.tip}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No hay fallos relevantes en el rango seleccionado.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Niveles actuales por categoría</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {detail?.student.skills.map((skill) => (
            <Badge key={skill.category}>{`${skill.category}: ${skill.currentLevel}`}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Sesiones recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length > 0 ? (
            sessions.map((session) => {
              const isExpanded = expandedSessions.has(session.id);
              return (
                <div
                  key={session.id}
                  className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 bg-white dark:border-slate-700 dark:bg-slate-800 ${accuracyBorderColor(session.stats.accuracy)}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSession(session.id)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(session.startedAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <Badge className="bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                      {MODE_LABELS[session.mode] ?? session.mode}
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty}
                    </Badge>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {session.stats.correct}/{session.stats.total}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        ({Math.round(session.stats.accuracy * 100)}%)
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatSeconds(session.stats.avgResponseMs)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDuration(session.startedAt, session.finishedAt)}
                    </span>
                    {session.assignment ? (
                      <Badge className="bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                        {session.assignment.title}
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
                      <div className="space-y-2">
                        {session.attempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                                {CATEGORY_LABELS[attempt.category] ?? attempt.category}
                              </Badge>
                              <Badge
                                className={
                                  attempt.isCorrect
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                }
                              >
                                {attempt.isCorrect ? 'Correcto' : 'Fallo'}
                              </Badge>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(attempt.answeredAt).toLocaleString('es-ES')}
                              </p>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {attempt.prompt}
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              Alumno: {attempt.studentAnswer} · Correcta: {attempt.expectedAnswer} · Nivel{' '}
                              {attempt.level} · {formatSeconds(attempt.responseMs)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No hay sesiones en el rango seleccionado.
            </p>
          )}
        </CardContent>
      </Card>

      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
