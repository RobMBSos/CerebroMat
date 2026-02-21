'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StudentMetricsChart } from '@/components/charts/student-metrics-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { apiRequest } from '@/lib/api';

type ClassOverviewResponse = {
  class: {
    id: string;
    name: string;
    description?: string | null;
    studentCount: number;
    teacher: {
      id: string;
      fullName: string;
      email: string;
    };
  } | null;
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    overallAccuracy: number;
    averageResponseMs: number;
    activeStudents: number;
  };
  byCategory: Array<{
    category: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
  }>;
  studentSummaries: Array<{
    student: {
      id: string;
      fullName: string;
      email: string;
      studentProfile: { ageGroup: string } | null;
    };
    metrics: {
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      accuracy: number;
      averageResponseMs: number;
    };
    weakCategory: {
      category: string;
      failures: number;
      attempts: number;
    } | null;
  }>;
  accuracySeries: Array<{ period: string; accuracy: number }>;
  timeSeries: Array<{ period: string; avgResponseMs: number }>;
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

export default function ClassAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const { loading: roleLoading, allowed } = useRoleGuard(['ADMIN', 'TEACHER']);
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [data, setData] = useState<ClassOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!params.id) {
      return;
    }

    try {
      setError(null);
      const response = await apiRequest<ClassOverviewResponse>(
        `/analytics/class-overview?classId=${params.id}&from=${from}T00:00:00.000Z&to=${to}T23:59:59.000Z&granularity=day${
          category ? `&category=${category}` : ''
        }`,
        { auth: true },
      );
      setData(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo cargar la analítica de clase',
      );
    }
  }, [category, from, params.id, to]);

  useEffect(() => {
    if (!allowed) {
      return;
    }
    void loadData();
  }, [allowed, loadData]);

  if (roleLoading || !allowed) {
    return null;
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
            Analítica de clase
          </p>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            {data?.class?.name ?? 'Clase'}
          </h2>
        </div>
        <Link href={`/classes/${params.id}`}>
          <Button variant="secondary">Volver a clase</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
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
            <Button onClick={() => void loadData()}>Aplicar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alumnos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {data?.class?.studentCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {data?.summary.totalAttempts ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Precisión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {Math.round((data?.summary.overallAccuracy ?? 0) * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo medio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {formatSeconds(data?.summary.averageResponseMs ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {data ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <StudentMetricsChart
            title="Precisión de clase"
            description="Aciertos agregados por día"
            color="#0f766e"
            metric="accuracy"
            yDomain={[0, 1]}
            data={data.accuracySeries}
          />
          <StudentMetricsChart
            title="Tiempo medio de clase"
            description="Segundos por intento"
            color="#0369a1"
            metric="avgResponseSeconds"
            data={data.timeSeries.map((item) => ({
              ...item,
              avgResponseSeconds: toSeconds(item.avgResponseMs),
            }))}
          />
        </div>
      ) : null}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Categorías con más fallos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {data?.byCategory
            .slice()
            .sort((left, right) => right.incorrect - left.incorrect)
            .map((item) => (
              <div
                key={item.category}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Fallos: {item.incorrect} / {item.attempts}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Precisión: {Math.round(item.accuracy * 100)}%
                </p>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Alumnos en detalle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.studentSummaries.map((item) => (
            <Link
              key={item.student.id}
              href={`/students/${item.student.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-black text-slate-800 dark:text-slate-100">
                    {item.student.fullName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {item.student.email}
                  </p>
                </div>
                <Badge>
                  {Math.round(item.metrics.accuracy * 100)}% precisión
                </Badge>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                <p className="text-slate-700 dark:text-slate-200">
                  Intentos: {item.metrics.totalAttempts}
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  Fallos: {item.metrics.incorrectAttempts}
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  Tiempo: {formatSeconds(item.metrics.averageResponseMs)}
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Refuerzo:{' '}
                  {item.weakCategory
                    ? CATEGORY_LABELS[item.weakCategory.category] ??
                      item.weakCategory.category
                    : 'N/A'}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </AppShell>
  );
}
