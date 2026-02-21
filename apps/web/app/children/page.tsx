'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { apiRequest } from '@/lib/api';

type OverviewResponse = {
  summary: {
    studentCount: number;
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    overallAccuracy: number;
  };
  students: Array<{
    student: {
      id: string;
      fullName: string;
      email: string;
      ageGroup: string | null;
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

export default function ChildrenPage() {
  const { session, loading } = useAuth();
  const { loading: roleLoading, allowed } = useRoleGuard([
    'ADMIN',
    'TEACHER',
    'PARENT',
  ]);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadOverview() {
      try {
        setError(null);
        const data = await apiRequest<OverviewResponse>('/students/overview', {
          auth: true,
        });
        setOverview(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'No se pudo cargar el resumen',
        );
      }
    }

    void loadOverview();
  }, [session]);

  if (loading || roleLoading || !session || !allowed) {
    return null;
  }

  const heading =
    session.user.role === 'PARENT' ? 'Mis hijos' : 'Resumen de alumnos';

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>
            Seguimiento rápido de precisión, tiempos y áreas con más fallos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
              Alumnos
            </p>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {overview?.summary.studentCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
              Intentos
            </p>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {overview?.summary.totalAttempts ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
              Precisión global
            </p>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {Math.round((overview?.summary.overallAccuracy ?? 0) * 100)}%
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Detalle por alumno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview?.students.map((item) => (
            <Link
              key={item.student.id}
              href={`/students/${item.student.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {item.student.fullName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {item.student.email}
                  </p>
                </div>
                <Badge>{item.student.ageGroup ?? 'Sin edad'}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <p className="text-slate-700 dark:text-slate-200">
                  Intentos: <strong>{item.metrics.totalAttempts}</strong>
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  Precisión:{' '}
                  <strong>{Math.round(item.metrics.accuracy * 100)}%</strong>
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  Fallos: <strong>{item.metrics.incorrectAttempts}</strong>
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  Tiempo medio:{' '}
                  <strong>{formatSeconds(item.metrics.averageResponseMs)}</strong>
                </p>
              </div>
              {item.weakCategory ? (
                <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Área a reforzar:{' '}
                  {CATEGORY_LABELS[item.weakCategory.category] ??
                    item.weakCategory.category}{' '}
                  ({item.weakCategory.failures} fallos)
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Aún no hay suficiente información para detectar un área débil.
                </p>
              )}
            </Link>
          ))}
          {overview?.students.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No hay alumnos vinculados todavía.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </AppShell>
  );
}
