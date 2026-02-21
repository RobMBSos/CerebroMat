'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

type Role = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export function useRoleGuard(roles: Role[], fallback = '/dashboard') {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    if (!roles.includes(session.user.role as Role)) {
      router.replace(fallback);
    }
  }, [fallback, loading, roles, router, session]);

  const allowed = session
    ? roles.includes(session.user.role as Role)
    : false;

  return {
    loading,
    allowed,
  };
}
