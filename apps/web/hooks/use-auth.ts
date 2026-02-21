'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getSession, type UserSession } from '@/lib/auth';

export function useAuth(redirectToLogin = true) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = getSession();
    setSession(current);
    setLoading(false);

    if (!current && redirectToLogin) {
      router.replace('/login');
    }
  }, [router, redirectToLogin]);

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return {
    session,
    loading,
    logout,
  };
}
