'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';

export default function StudentsMePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.user.role === 'PARENT') {
      router.replace('/children');
      return;
    }

    if (session.user.role === 'STUDENT') {
      router.replace(`/students/${session.user.id}`);
      return;
    }

    async function redirectFirst() {
      const students = await apiRequest<Array<{ id: string }>>('/students', { auth: true });
      if (students[0]?.id) {
        router.replace(`/students/${students[0].id}`);
        return;
      }
      router.replace('/dashboard');
    }

    void redirectFirst();
  }, [router, session]);

  if (loading) {
    return null;
  }

  return null;
}
