'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { StudentMetricsChart } from '@/components/charts/student-metrics-chart';
import { StudentExercisePanel } from '@/components/student-exercise-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

type AssignmentItem = {
  id: string;
  title: string;
  description?: string;
  totalExercises: number;
  difficulty: string;
  dueDate?: string;
  class: { name: string };
};

function toSeconds(valueMs: number): number {
  return Number((valueMs / 1000).toFixed(2));
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  PARENT: 'Padre/Madre',
  STUDENT: 'Alumno',
};

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Join class state (students)
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Pending assignments state (students)
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<AssignmentItem | null>(null);

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

        const initialStudentId =
          activeSession.user.role === 'STUDENT'
            ? activeSession.user.id
            : (studentsData[0]?.id ?? null);

        setSelectedStudentId(initialStudentId);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar dashboard');
      }
    }

    void loadData(session);
  }, [session]);

  // Load pending assignments independently for students
  useEffect(() => {
    if (!session || session.user.role !== 'STUDENT') {
      return;
    }

    async function loadAssignments() {
      try {
        const data = await apiRequest<AssignmentItem[]>('/assignments', { auth: true });
        console.log('[CerebroMat] Loaded assignments:', data);
        setAssignments(data);
      } catch (err) {
        console.error('[CerebroMat] Failed to load assignments:', err);
      }
    }

    void loadAssignments();
  }, [session]);

  useEffect(() => {
    if (!session || !selectedStudentId) {
      setAnalytics(null);
      return;
    }

    async function loadAnalytics(studentId: string) {
      try {
        setError(null);
        const analyticsData = await apiRequest<AnalyticsData>(
          `/analytics/student-series?studentId=${studentId}&granularity=day`,
          { auth: true },
        );
        setAnalytics(analyticsData);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar analítica');
      }
    }

    void loadAnalytics(selectedStudentId);
  }, [selectedStudentId, session]);

  async function handleJoinClass(event: FormEvent) {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setJoinSuccess(null);
    setError(null);

    try {
      await apiRequest('/classes/join', {
        method: 'POST',
        auth: true,
        body: { code: joinCode.trim() },
      });
      setJoinSuccess('Te has unido a la clase correctamente.');
      setJoinCode('');
      // Reload assignments after joining a class
      try {
        const assignmentsData = await apiRequest<AssignmentItem[]>('/assignments', { auth: true });
        setAssignments(assignmentsData);
      } catch { /* ignore */ }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo unir a la clase');
    } finally {
      setJoinLoading(false);
    }
  }

  const totalStudents = useMemo(() => students.length, [students.length]);
  const totalClasses = useMemo(() => classes.length, [classes.length]);
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );
  const isStudent = session?.user.role === 'STUDENT';

  if (loading || !session) {
    return null;
  }

  return (
    <AppShell>
      {/* Pending assignments notification banner — top of page for students */}
      {isStudent && !activeAssignment && assignments.length > 0 ? (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-3 shadow-md dark:border-amber-500 dark:bg-amber-950/50">
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">!</span>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
              Tienes {assignments.length} tarea{assignments.length > 1 ? 's' : ''} pendiente{assignments.length > 1 ? 's' : ''}
            </p>
          </div>
          {assignments.map((assignment) => {
            const isOverdue = assignment.dueDate
              ? new Date(assignment.dueDate) < new Date()
              : false;
            return (
              <div
                key={assignment.id}
                className={`flex items-center justify-between rounded-xl border-2 p-4 shadow-sm ${
                  isOverdue
                    ? 'border-rose-400 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/40'
                    : 'border-amber-300 bg-white dark:border-amber-600 dark:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">{assignment.title}</p>
                    {isOverdue ? (
                      <Badge className="bg-rose-500 text-white dark:bg-rose-600">Atrasada</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {assignment.class.name} &middot; {assignment.totalExercises} ejercicios
                    {assignment.dueDate ? ` · Fecha límite: ${new Date(assignment.dueDate).toLocaleDateString('es-ES')}` : ''}
                  </p>
                </div>
                <Button onClick={() => setActiveAssignment(assignment)}>
                  Empezar
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {isStudent && activeAssignment ? (
        <div className="mb-6">
          <StudentExercisePanel
            assignmentId={activeAssignment.id}
            assignmentTitle={activeAssignment.title}
            onAssignmentComplete={() => {
              setActiveAssignment(null);
              setAssignments((prev) => prev.filter((a) => a.id !== activeAssignment.id));
            }}
          />
        </div>
      ) : null}

      {isStudent && !activeAssignment ? (
        <div className="mb-6">
          <StudentExercisePanel />
        </div>
      ) : null}

      {isStudent ? (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Unirse a una clase</CardTitle>
              <CardDescription>Introduce el código que te ha dado tu profesor.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex gap-2" onSubmit={handleJoinClass}>
                <Input
                  placeholder="Código de clase"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={joinLoading}>
                  {joinLoading ? 'Uniendo...' : 'Unirse'}
                </Button>
              </form>
              {joinSuccess ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{joinSuccess}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!isStudent ? (
        <>
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
                <CardTitle className="text-2xl">
                  {ROLE_LABELS[session.user.role] ?? session.user.role}
                </CardTitle>
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
        </>
      ) : null}

      {session.user.role === 'STUDENT' || students.length > 0 ? (
        <>
          <Card className="mt-6">
            <CardHeader className="gap-3">
              <CardTitle>Analítica rápida</CardTitle>
              <CardDescription>
                {selectedStudent
                  ? `Seleccionado: ${selectedStudent.fullName}`
                  : 'Selecciona un alumno para ver sus gráficas'}
              </CardDescription>
              {session.user.role !== 'STUDENT' ? (
                <Select
                  value={selectedStudentId ?? ''}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  options={students.map((student) => ({
                    value: student.id,
                    label: student.fullName,
                  }))}
                />
              ) : null}
              {students.length === 0 && session.user.role !== 'STUDENT' ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No hay alumnos disponibles para mostrar analítica.
                </p>
              ) : null}
            </CardHeader>
          </Card>
          {analytics ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <StudentMetricsChart
                title="Aciertos por día"
                description="Porcentaje de aciertos del alumno seleccionado"
                color="#0f766e"
                metric="accuracy"
                yDomain={[0, 1]}
                data={analytics.accuracySeries}
              />
              <StudentMetricsChart
                title="Tiempo medio"
                description="Segundos por intento del alumno seleccionado"
                color="#0369a1"
                metric="avgResponseSeconds"
                data={analytics.timeSeries.map((item) => ({
                  ...item,
                  avgResponseSeconds: toSeconds(item.avgResponseMs),
                }))}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
