'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type RoleOption = 'STUDENT' | 'TEACHER' | 'PARENT';

const roleOptions: Array<{ label: string; value: RoleOption }> = [
  { label: 'Alumno', value: 'STUDENT' },
  { label: 'Profesor', value: 'TEACHER' },
  { label: 'Padre/Madre', value: 'PARENT' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RoleOption>('STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; fullName: string; role: 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT' };
      }>('/auth/register', {
        method: 'POST',
        body: { fullName, email, password, role },
      });

      setSession(data);
      router.replace('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0d2847] to-[#091a2f] p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm">
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
            Crear cuenta
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-sm">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-cyan-100" htmlFor="fullName">
                Nombre completo
              </label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="border-slate-600 bg-slate-800/80 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
                required
              />
            </div>
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
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-cyan-100" htmlFor="password">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-slate-600 bg-slate-800/80 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-cyan-100" htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="border-slate-600 bg-slate-800/80 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-500"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-cyan-100">Rol</p>
              <div className="flex gap-2">
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      role === option.value
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-cyan-100 hover:bg-slate-700'
                    }`}
                    onClick={() => setRole(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}
            <Button
              className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 focus-visible:ring-cyan-500"
              size="lg"
              disabled={loading}
              type="submit"
            >
              <UserPlus className="mr-2 size-4" />
              {loading ? 'Creando...' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-cyan-200/70">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-cyan-400 hover:text-cyan-300">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-8 text-xs font-semibold text-cyan-100/40">
        Hecha con ❤️ desde Málaga por Mateo y Roberto
      </p>
    </div>
  );
}
