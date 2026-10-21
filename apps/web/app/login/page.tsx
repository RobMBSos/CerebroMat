'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0d2847] to-[#091a2f] p-4">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* Main login panel */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo section */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/CerebroMat_robot.png"
            alt="Robot CerebroMat"
            width={160}
            height={160}
            className="h-28 w-28 drop-shadow-[0_0_30px_rgba(6,182,212,0.3)] md:h-36 md:w-36"
            priority
          />
          <Image
            src="/CerebroMat_Letras_logo.png"
            alt="CerebroMat"
            width={500}
            height={120}
            className="mt-3 h-12 w-auto md:h-14"
            priority
          />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400/70">
            Panel Escolar
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-sm">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-cyan-100" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="border-slate-600 bg-slate-800/80 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-cyan-100" htmlFor="password">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-slate-600 bg-slate-800/80 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
              />
            </div>
            {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}
            <Button
              className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 focus-visible:ring-cyan-500"
              size="lg"
              disabled={loading}
              type="submit"
            >
              <LogIn className="mr-2 size-4" />
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-cyan-200/70">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-semibold text-cyan-400 hover:text-cyan-300">
              Crear cuenta
            </Link>
          </p>


        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs font-semibold text-cyan-100/40">
        Hecha con ❤️ desde Málaga por Mateo y Roberto
      </p>
    </div>
  );
}
