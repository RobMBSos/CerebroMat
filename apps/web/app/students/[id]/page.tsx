'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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

function toSeconds(ms: number): number {
  return Number((ms / 1000).toFixed(2));
}

export default function StudentDetailPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ id: string }>();

  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [history, setHistory] = useState<StudentHistoryResponse | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentId = useMemo(() => params.id, [params.id]);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [detailData, analyticsData, historyData] = await Promise.all([
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
      ]);

      setDetail(detailData);
      setAnalytics(analyticsData);
      setHistory(historyData);
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

  return (
    <AppShell>
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
            metric="avgResponseMs"
            data={analytics.timeSeries.map((item) => ({
              ...item,
              avgResponseMs: toSeconds(item.avgResponseMs),
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
          <CardTitle>Historial reciente (correcto/fallo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history?.attempts.length ? (
            history.attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
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
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{attempt.prompt}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Alumno: {attempt.studentAnswer} · Correcta: {attempt.expectedAnswer} · Nivel {attempt.level} ·{' '}
                  {formatSeconds(attempt.responseMs)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Todavía no hay intentos en el rango seleccionado.
            </p>
          )}
        </CardContent>
      </Card>

      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
