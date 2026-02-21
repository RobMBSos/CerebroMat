'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

type ClassItem = {
  id: string;
  name: string;
  description?: string;
  _count?: { enrollments: number };
};

export default function ClassesPage() {
  const { session, loading } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadClasses() {
    try {
      const data = await apiRequest<ClassItem[]>('/classes', { auth: true });
      setClasses(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Error al cargar clases');
    }
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadClasses();
  }, [session]);

  async function onCreateClass(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest('/classes', {
        method: 'POST',
        auth: true,
        body: { name, description },
      });

      setName('');
      setDescription('');
      await loadClasses();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la clase');
    }
  }

  if (loading || !session) {
    return null;
  }

  const canCreate = session.user.role === 'ADMIN' || session.user.role === 'TEACHER';

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_2fr]">
        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle>Nueva clase</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onCreateClass}>
                <Input placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} />
                <Input
                  placeholder="Descripción"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <Button className="w-full" type="submit">
                  Crear clase
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Listado de clases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.map((item) => (
              <Link
                key={item.id}
                href={`/classes/${item.id}`}
                className="block rounded-xl border border-cyan-100 bg-cyan-50 p-4 transition-colors hover:bg-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{item.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{item.description || 'Sin descripción'}</p>
                <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  {item._count?.enrollments ?? 0} alumnos inscritos
                </p>
              </Link>
            ))}
            {classes.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No se encontraron clases.</p> : null}
          </CardContent>
        </Card>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </AppShell>
  );
}
