'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const code = new URL(location.href).searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => router.replace('/'))
        .catch(() => router.replace('/login'));
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="flex h-screen items-center justify-center bg-neutral-950">
      <span className="text-neutral-500 font-mono text-sm">Signing in…</span>
    </main>
  );
}
