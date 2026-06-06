'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950">
        <span className="text-neutral-500 font-mono text-sm">Loading…</span>
      </main>
    );
  }

  return (
    <main className="flex h-screen items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-mono tracking-widest text-neutral-200 uppercase">
          Drum Trainer
        </h1>
        <p className="text-sm text-neutral-500">Sign in to access your tracks</p>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 px-6 py-3 rounded bg-white text-neutral-900 font-medium hover:bg-neutral-100 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
