'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { StudentMetricsChart } from '@/components/charts/student-metrics-chart';
import { StudentExercisePanel } from '@/components/student-exercise-panel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

type ClassItem = {
  id: string;
  name: string;
  _count?: { enrollments: number };
};

type StudentItem = {
  id: string;
  fullName: string;
  email: string;
};

type AnalyticsData = {
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    overallAccuracy: number;
    averageResponseMs: number;
  };
  accuracySeries: Array<{ period: string; accuracy: number }>;
  timeSeries: Array<{ period: string; avgResponseMs: number }>;
};

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadData(activeSession: NonNullable<typeof session>) {
      try {
        const [classesData, studentsData] = await Promise.all([
          apiRequest<ClassItem[]>('/classes', { auth: true }),
          apiRequest<StudentItem[]>('/students', { auth: true }),
        ]);

        setClasses(classesData);
        setStudents(studentsData);

        const studentId =
          activeSession.user.role === 'STUDENT'
            ? activeSession.user.id
            : (studentsData[0]?.id ?? activeSession.user.id);

        if (studentId) {
          const analyticsData = await apiRequest<AnalyticsData>(
            `/analytics/student-series?studentId=${studentId}&granularity=day`,
            { auth: true },
          );
          setAnalytics(analyticsData);
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar dashboard');
      }
    }

    void loadData(session);
  }, [session]);

  const totalStudents = useMemo(() => students.length, [students.length]);
  const totalClasses = useMemo(() => classes.length, [classes.length]);

  if (loading || !session) {
    return null;
  }

  return (
    <AppShell>
      {session.user.role === 'STUDENT' ? (
        <div className="mb-6">
          <StudentExercisePanel />
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Clases activas</CardDescription>
            <CardTitle className="text-4xl">{totalClasses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Alumnos visibles</CardDescription>
            <CardTitle className="text-4xl">{totalStudents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rol de acceso</CardDescription>
            <CardTitle className="text-2xl">{session.user.role}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clases</CardTitle>
            <CardDescription>Acceso rápido a detalles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.map((item) => (
              <Link
                key={item.id}
                href={`/classes/${item.id}`}
                className="block rounded-xl border border-cyan-100 bg-cyan-50 p-3 transition-colors hover:bg-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{item._count?.enrollments ?? 0} alumnos</p>
              </Link>
            ))}
            {classes.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No hay clases para este usuario.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alumnos</CardTitle>
            <CardDescription>Selecciona para ver progreso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map((student) => (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="flex items-center justify-between rounded-xl border border-sky-100 bg-white p-3 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{student.fullName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{student.email}</p>
                </div>
                <Badge>Ver detalle</Badge>
              </Link>
            ))}
            {students.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No hay alumnos cargados.</p> : null}
          </CardContent>
        </Card>
      </div>

      {analytics ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <StudentMetricsChart
            title="Aciertos por día"
            description="Evolución de precisión"
            color="#0f766e"
            metric="accuracy"
            yDomain={[0, 1]}
            data={analytics.accuracySeries}
          />
          <StudentMetricsChart
            title="Tiempo medio"
            description="Milisegundos por intento"
            color="#0369a1"
            metric="avgResponseMs"
            data={analytics.timeSeries}
          />
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
