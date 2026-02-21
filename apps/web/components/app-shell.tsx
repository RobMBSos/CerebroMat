'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Role = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  PARENT: 'Padre/Madre',
  STUDENT: 'Alumno',
};

const links: Array<{
  href: string;
  label: string;
  studentLabel?: string;
  parentLabel?: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}> = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT'],
  },
  {
    href: '/classes',
    label: 'Clases',
    icon: BookOpen,
    roles: ['ADMIN', 'TEACHER', 'STUDENT'],
  },
  {
    href: '/children',
    label: 'Alumnos',
    parentLabel: 'Hijos',
    icon: Users,
    roles: ['ADMIN', 'TEACHER', 'PARENT'],
  },
  {
    href: '/students/me',
    label: 'Alumnos',
    studentLabel: 'Mi Progreso',
    icon: Users,
    roles: ['STUDENT'],
  },
];

function isActivePath(pathname: string, href: string, role?: Role) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  if (href === '/children') {
    return (
      pathname === '/children' ||
      (role !== 'STUDENT' && pathname.startsWith('/students/'))
    );
  }
  if (href === '/students/me') {
    return pathname.startsWith('/students/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const role = session?.user.role as Role | undefined;
  const visibleLinks = links.filter((link) =>
    role ? link.roles.includes(role) : true,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ccfbf1_0%,_#f0f9ff_35%,_#ecfeff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_#083344_0%,_#0b1120_45%,_#020617_100%)]">
      <header className="sticky top-0 z-10 border-b border-cyan-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">CerebroMat</p>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">Panel Escolar</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{session?.user.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {role ? roleLabels[role] : ''}
              </p>
            </div>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                    isActivePath(pathname, link.href, role)
                      ? 'bg-cyan-700 text-white dark:bg-cyan-500 dark:text-slate-950'
                      : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:bg-slate-800 dark:text-cyan-100 dark:hover:bg-slate-700',
                  )}
                >
                  <Icon className="size-4" />
                  {role === 'STUDENT' && link.studentLabel
                    ? link.studentLabel
                    : role === 'PARENT' && link.parentLabel
                      ? link.parentLabel
                      : link.label}
                </Link>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={logout}>
            <LogOut className="mr-2 size-4" />
            Salir
          </Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
