'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function ClassDetailPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [inviteType, setInviteType] = useState<'STUDENT' | 'PARENT'>('STUDENT');
  const [studentId, setStudentId] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session || !params.id) {
      return;
    }
    void loadDetail();
  }, [session, params.id, loadDetail]);

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

  if (loading || !session) {
    return null;
  }

  if (!detail) {
    return <AppShell>{error ? <p className="text-red-700 dark:text-red-300">{error}</p> : null}</AppShell>;
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'TEACHER';

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
              <CardTitle>{detail.name}</CardTitle>
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
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
