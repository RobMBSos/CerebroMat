'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select } from '@/components/ui/select';
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
      classes: Array<{
        id: string;
        name: string;
      }>;
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

type ClassItem = {
  id: string;
  name: string;
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

type StudentOverviewItem = OverviewResponse['students'][number];

export default function ChildrenPage() {
  const { session, loading } = useAuth();
  const { loading: roleLoading, allowed } = useRoleGuard([
    'ADMIN',
    'TEACHER',
    'PARENT',
  ]);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teacherOrAdmin =
    session?.user.role === 'TEACHER' || session?.user.role === 'ADMIN';

  useEffect(() => {
    if (!session || !teacherOrAdmin) {
      return;
    }

    async function loadClasses() {
      try {
        setError(null);
        const data = await apiRequest<Array<{ id: string; name: string }>>(
          '/classes',
          {
            auth: true,
          },
        );

        const sorted = data
          .map((item) => ({ id: item.id, name: item.name }))
          .sort((left, right) =>
            left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
          );

        setClasses(sorted);
        setSelectedClassId((current) => {
          if (current && sorted.some((item) => item.id === current)) {
            return current;
          }
          return sorted[0]?.id ?? '';
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'No se pudieron cargar las clases',
        );
      }
    }

    void loadClasses();
  }, [session, teacherOrAdmin]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (teacherOrAdmin) {
      if (classes.length === 0) {
        setOverview({
          summary: {
            studentCount: 0,
            totalAttempts: 0,
            correctAttempts: 0,
            incorrectAttempts: 0,
            overallAccuracy: 0,
          },
          students: [],
        });
        return;
      }

      if (!selectedClassId) {
        return;
      }
    }

    async function loadOverview() {
      try {
        setError(null);
        const query =
          teacherOrAdmin && selectedClassId
            ? `?classId=${selectedClassId}`
            : '';

        const data = await apiRequest<OverviewResponse>(
          `/students/overview${query}`,
          {
            auth: true,
          },
        );

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
  }, [classes.length, selectedClassId, session, teacherOrAdmin]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const groupedByClass = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; students: StudentOverviewItem[] }
    >();
    const withoutClass: StudentOverviewItem[] = [];

    for (const row of overview?.students ?? []) {
      if (row.student.classes.length === 0) {
        withoutClass.push(row);
        continue;
      }

      for (const classroom of row.student.classes) {
        const current = groups.get(classroom.id);
        if (current) {
          current.students.push(row);
          continue;
        }

        groups.set(classroom.id, {
          id: classroom.id,
          name: classroom.name,
          students: [row],
        });
      }
    }

    const groupedClasses = Array.from(groups.values())
      .map((item) => ({
        ...item,
        students: item.students.sort((left, right) =>
          left.student.fullName.localeCompare(right.student.fullName, 'es', {
            sensitivity: 'base',
          }),
        ),
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
      );

    return {
      classes: groupedClasses,
      withoutClass: withoutClass.sort((left, right) =>
        left.student.fullName.localeCompare(right.student.fullName, 'es', {
          sensitivity: 'base',
        }),
      ),
    };
  }, [overview?.students]);

  if (loading || roleLoading || !session || !allowed) {
    return null;
  }

  const heading =
    session.user.role === 'PARENT' ? 'Mis hijos' : 'Resumen de alumnos';

  return (
    <AppShell>
      {teacherOrAdmin ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Clase seleccionada</CardTitle>
            <CardDescription>
              Elige clase y mostramos solo sus alumnos para evitar listas
              demasiado largas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length > 0 ? (
              <Select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                options={classes.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No hay clases disponibles para mostrar alumnos.
              </p>
            )}
            {selectedClass ? (
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Mostrando: {selectedClass.name}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>
            Seguimiento rápido de precisión, tiempos y áreas con más fallos.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={`grid gap-4 ${teacherOrAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
        >
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
              Alumnos
            </p>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {overview?.summary.studentCount ?? 0}
            </p>
          </div>
          {teacherOrAdmin ? (
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
                Clases
              </p>
              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
                {classes.length}
              </p>
            </div>
          ) : null}
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

      {teacherOrAdmin ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Alumnos por clase</CardTitle>
            <CardDescription>
              Listado de la clase seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedByClass.classes.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {group.name}
                  </p>
                  <Badge>{group.students.length} alumnos</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {group.students.map((item) => (
                    <Link
                      key={`${group.id}-${item.student.id}`}
                      href={`/students/${item.student.id}`}
                      className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 transition-colors hover:bg-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                    >
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {item.student.fullName}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Precisión {Math.round(item.metrics.accuracy * 100)}% ·
                        Fallos {item.metrics.incorrectAttempts} ·{' '}
                        {formatSeconds(item.metrics.averageResponseMs)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {groupedByClass.withoutClass.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="font-black text-amber-900 dark:text-amber-200">
                  Sin clase asignada
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {groupedByClass.withoutClass.map((item) => (
                    <Link
                      key={`without-class-${item.student.id}`}
                      href={`/students/${item.student.id}`}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {item.student.fullName}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {groupedByClass.classes.length === 0 &&
            groupedByClass.withoutClass.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Todavía no hay alumnos para mostrar por clase.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                  {item.student.classes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.student.classes.map((classroom) => (
                        <span
                          key={`${item.student.id}-${classroom.id}`}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                        >
                          {classroom.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Sin clase asignada
                    </p>
                  )}
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
