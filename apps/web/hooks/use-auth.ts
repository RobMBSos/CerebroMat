'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearSession,
  getSession,
  setSession as persistSession,
  type UserSession,
} from '@/lib/auth';
import { API_URL } from '@/lib/api';

export function useAuth(redirectToLogin = true) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      const current = getSession();

      if (!mounted) {
        return;
      }

      setSession(current);

      if (!current) {
        setLoading(false);
        if (redirectToLogin) {
          router.replace('/login');
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${current.accessToken}`,
          },
        });

        if (response.ok) {
          const user = (await response.json()) as UserSession['user'];
          const refreshedSession: UserSession = {
            ...current,
            user: {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
            },
          };
          persistSession(refreshedSession);

          if (mounted) {
            setSession(refreshedSession);
          }
        }
      } catch {
        // Keep local session if profile refresh fails.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      mounted = false;
    };
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
