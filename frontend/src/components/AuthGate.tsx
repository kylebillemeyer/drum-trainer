'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950">
        <span className="text-neutral-500 font-mono text-sm">Loading…</span>
      </main>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
