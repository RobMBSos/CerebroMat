'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

type ClassDetail = {
  id: string;
  name: string;
  description?: string;
  enrollments: Array<{
    student: {
      id: string;
      fullName: string;
      email: string;
      studentProfile: { ageGroup: string } | null;
    };
  }>;
  invites: Array<{
    id: string;
    code: string;
    type: 'STUDENT' | 'PARENT';
    expiresAt: string;
    usedAt: string | null;
  }>;
};

type CompletionScore = {
  total: number;
  correct: number;
  accuracy: number;
  avgMs: number;
};

type AssignmentDetail = {
  id: string;
  title: string;
  description?: string;
  classId: string;
  ageGroup: string;
  mode: string;
  categories: string[];
  totalExercises: number;
  difficulty: string;
  dueDate?: string;
  createdAt: string;
  completions: Array<{
    student: { id: string; fullName: string };
    score?: CompletionScore;
  }>;
};

type AgeGroup = 'INFANT_3_5' | 'AGE_6_7' | 'AGE_8_9' | 'AGE_10_12';
type Mode = 'OPERATIONS' | 'WORD_PROBLEMS' | 'MIXED';
type Category = 'ADDITION' | 'SUBTRACTION' | 'MULTIPLICATION' | 'DIVISION' | 'WORD_PROBLEM';
type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD';

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

const difficultyOptions: Array<{ label: string; value: DifficultyLevel }> = [
  { label: 'Fácil', value: 'EASY' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Difícil', value: 'HARD' },
];

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
};

const MODE_LABELS: Record<string, string> = {
  OPERATIONS: 'Operaciones',
  WORD_PROBLEMS: 'Problemas',
  MIXED: 'Mixto',
};

export default function ClassDetailPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [inviteType, setInviteType] = useState<'STUDENT' | 'PARENT'>('STUDENT');
  const [studentId, setStudentId] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aAgeGroup, setAAgeGroup] = useState<AgeGroup>('AGE_8_9');
  const [aMode, setAMode] = useState<Mode>('MIXED');
  const [aCategories, setACategories] = useState<Category[]>(['ADDITION', 'SUBTRACTION']);
  const [aDifficulty, setADifficulty] = useState<DifficultyLevel>('NORMAL');
  const [aTotalExercises, setATotalExercises] = useState(10);
  const [aDueDate, setADueDate] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const data = await apiRequest<ClassDetail>(`/classes/${params.id}`, { auth: true });
      setDetail(data);
      if (!studentId && data.enrollments[0]?.student.id) {
        setStudentId(data.enrollments[0].student.id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la clase');
    }
  }, [params.id, studentId]);

  const loadAssignments = useCallback(async () => {
    try {
      const data = await apiRequest<AssignmentDetail[]>('/assignments', { auth: true });
      setAssignments(data.filter((a) => a.classId === params.id));
    } catch {
      // Non-critical
    }
  }, [params.id]);

  useEffect(() => {
    if (!session || !params.id) {
      return;
    }
    void loadDetail();
    void loadAssignments();
  }, [session, params.id, loadDetail, loadAssignments]);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const created = await apiRequest<{ code: string }>(`/classes/${params.id}/invites`, {
        method: 'POST',
        auth: true,
        body: {
          type: inviteType,
          studentId: inviteType === 'PARENT' ? studentId : undefined,
          expiresInDays: 7,
        },
      });

      setCreatedCode(created.code);
      await loadDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear el código');
    }
  }

  function toggleCategory(category: Category) {
    setACategories((prev) =>
      prev.includes(category)
        ? prev.length > 1
          ? prev.filter((c) => c !== category)
          : prev
        : [...prev, category],
    );
  }

  async function createAssignment(event: FormEvent) {
    event.preventDefault();
    setAssignmentSaving(true);
    setError(null);

    try {
      await apiRequest('/assignments', {
        method: 'POST',
        auth: true,
        body: {
          title: aTitle,
          classId: params.id,
          ageGroup: aAgeGroup,
          mode: aMode,
          categories: aCategories,
          totalExercises: aTotalExercises,
          difficulty: aDifficulty,
          dueDate: aDueDate ? new Date(aDueDate).toISOString() : undefined,
        },
      });

      setShowAssignmentForm(false);
      setATitle('');
      await loadAssignments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la tarea');
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function deleteAssignment(id: string) {
    try {
      await apiRequest(`/assignments/${id}`, { method: 'DELETE', auth: true });
      await loadAssignments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la tarea');
    }
  }

  if (loading || !session) {
    return null;
  }

  if (!detail) {
    return <AppShell>{error ? <p className="text-red-700 dark:text-red-300">{error}</p> : null}</AppShell>;
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'TEACHER';
  const totalStudents = detail.enrollments.length;

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_2fr]">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Invitaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={createInvite}>
                <Select
                  value={inviteType}
                  onChange={(event) => setInviteType(event.target.value as 'STUDENT' | 'PARENT')}
                  options={[
                    { label: 'Código alumno', value: 'STUDENT' },
                    { label: 'Código padre/madre', value: 'PARENT' },
                  ]}
                />
                {inviteType === 'PARENT' ? (
                  <Select
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    options={detail.enrollments.map((enrollment) => ({
                      label: enrollment.student.fullName,
                      value: enrollment.student.id,
                    }))}
                  />
                ) : null}
                <Button className="w-full" type="submit">
                  Generar código
                </Button>
              </form>
              {createdCode ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Código creado: {createdCode}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{detail.name}</CardTitle>
                {canManage ? (
                  <Link href={`/classes/${detail.id}/analytics`}>
                    <Button size="sm" variant="secondary">
                      Ver analítica
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 dark:text-slate-300">{detail.description || 'Sin descripción'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alumnos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.enrollments.map((enrollment) => (
                <Link
                  key={enrollment.student.id}
                  href={`/students/${enrollment.student.id}`}
                  className="flex items-center justify-between rounded-xl border border-cyan-100 bg-cyan-50 p-3 transition-colors hover:bg-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{enrollment.student.fullName}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{enrollment.student.email}</p>
                  </div>
                  <Badge>{enrollment.student.studentProfile?.ageGroup ?? 'Sin edad'}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Assignments section */}
          {canManage ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Tareas</CardTitle>
                  <Button size="sm" onClick={() => setShowAssignmentForm(!showAssignmentForm)}>
                    {showAssignmentForm ? 'Cancelar' : 'Nueva tarea'}
                  </Button>
                </div>
                <CardDescription>Asigna ejercicios a los alumnos de esta clase.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAssignmentForm ? (
                  <form className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60" onSubmit={createAssignment}>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="aTitle">
                        Título
                      </label>
                      <Input
                        id="aTitle"
                        value={aTitle}
                        onChange={(e) => setATitle(e.target.value)}
                        placeholder="Ej: Repaso de sumas"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edad</p>
                      <div className="flex flex-wrap gap-2">
                        {ageOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              aAgeGroup === opt.value
                                ? 'bg-cyan-700 text-white dark:bg-cyan-500 dark:text-slate-950'
                                : 'bg-cyan-100 text-cyan-900 hover:bg-cyan-200 dark:bg-slate-700 dark:text-cyan-100'
                            }`}
                            onClick={() => setAAgeGroup(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Modo</p>
                      <div className="flex flex-wrap gap-2">
                        {modeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              aMode === opt.value
                                ? 'bg-sky-700 text-white dark:bg-sky-500 dark:text-slate-950'
                                : 'bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-slate-700 dark:text-sky-100'
                            }`}
                            onClick={() => setAMode(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Categorías</p>
                      <div className="flex flex-wrap gap-2">
                        {categoryOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              aCategories.includes(opt.value)
                                ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                                : 'bg-teal-100 text-teal-900 hover:bg-teal-200 dark:bg-slate-700 dark:text-teal-100'
                            }`}
                            onClick={() => toggleCategory(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dificultad</p>
                      <div className="flex flex-wrap gap-2">
                        {difficultyOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                              aDifficulty === opt.value
                                ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950'
                                : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-slate-700 dark:text-amber-100'
                            }`}
                            onClick={() => setADifficulty(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="aTotalExercises">
                          N.º ejercicios
                        </label>
                        <Input
                          id="aTotalExercises"
                          type="number"
                          min={1}
                          max={50}
                          value={aTotalExercises}
                          onChange={(e) => setATotalExercises(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="aDueDate">
                          Fecha límite
                        </label>
                        <Input
                          id="aDueDate"
                          type="date"
                          value={aDueDate}
                          onChange={(e) => setADueDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button className="w-full" type="submit" disabled={assignmentSaving}>
                      {assignmentSaving ? 'Creando...' : 'Crear tarea'}
                    </Button>
                  </form>
                ) : null}

                {/* Assignment list */}
                {assignments.map((assignment) => {
                  const completedCount = assignment.completions.length;
                  return (
                    <div
                      key={assignment.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{assignment.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {MODE_LABELS[assignment.mode] ?? assignment.mode} &middot;{' '}
                            {DIFFICULTY_LABELS[assignment.difficulty] ?? assignment.difficulty} &middot;{' '}
                            {assignment.totalExercises} ejercicios
                            {assignment.dueDate ? ` · Límite: ${new Date(assignment.dueDate).toLocaleDateString('es-ES')}` : ''}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                            {completedCount}/{totalStudents} completado
                          </p>
                          {assignment.completions.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {assignment.completions.map((c) => (
                                <div key={c.student.id} className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.student.fullName}</span>
                                  {c.score ? (
                                    <span className={`font-bold ${c.score.accuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {c.score.correct}/{c.score.total} ({c.score.accuracy}%) &middot; {(c.score.avgMs / 1000).toFixed(1)}s
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">sin datos</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void deleteAssignment(assignment.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {assignments.length === 0 && !showAssignmentForm ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">No hay tareas creadas para esta clase.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Códigos recientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detail.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{invite.code}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {invite.type} • expira {invite.expiresAt.slice(0, 10)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{invite.usedAt ? 'Usado' : 'Disponible'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
