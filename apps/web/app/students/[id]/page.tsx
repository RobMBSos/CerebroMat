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

export default function StudentDetailPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ id: string }>();

  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentId = useMemo(() => params.id, [params.id]);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [detailData, analyticsData] = await Promise.all([
        apiRequest<StudentDetailResponse>(`/students/${studentId}`, { auth: true }),
        apiRequest<AnalyticsResponse>(
          `/analytics/student-series?studentId=${studentId}&from=${from}T00:00:00.000Z&to=${to}T23:59:59.000Z&granularity=day${
            category ? `&category=${category}` : ''
          }`,
          { auth: true },
        ),
      ]);

      setDetail(detailData);
      setAnalytics(analyticsData);
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
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{detail?.metrics.avgResponseMs ?? 0}ms</p>
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
            description="Tiempo medio por intento"
            color="#0284c7"
            metric="avgResponseMs"
            data={analytics.timeSeries}
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
          <CardTitle>Niveles actuales por categoría</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {detail?.student.skills.map((skill) => (
            <Badge key={skill.category}>{`${skill.category}: ${skill.currentLevel}`}</Badge>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
