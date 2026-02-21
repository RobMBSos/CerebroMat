'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function StudentsMePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.user.role === 'STUDENT') {
      router.replace(`/students/${session.user.id}`);
      return;
    }

    if (
      session.user.role === 'PARENT' ||
      session.user.role === 'TEACHER' ||
      session.user.role === 'ADMIN'
    ) {
      router.replace('/children');
      return;
    }
  }, [router, session]);

  if (loading) {
    return null;
  }

  return null;
}
