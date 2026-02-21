'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('teacher@demo.local');
  const [password, setPassword] = useState('Demo12345!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; fullName: string; role: 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT' };
      }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setSession(data);
      router.replace('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#99f6e4_0%,_#e0f2fe_50%,_#f0fdfa_100%)] p-4 dark:bg-[radial-gradient(circle_at_top_left,_#083344_0%,_#0b1120_45%,_#020617_100%)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">CerebroMat</CardTitle>
          <CardDescription>Inicia sesion para entrar al panel escolar</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-100">
            <p className="font-semibold">Credenciales demo rápidas</p>
            <p>teacher@demo.local / Demo12345!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
