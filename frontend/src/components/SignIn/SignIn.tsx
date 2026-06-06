'use client';

import { useAuth } from '@/context/AuthContext';

export default function SignIn() {
  const { signInWithGoogle } = useAuth();

  return (
    <main className="flex items-center justify-center h-screen bg-neutral-950 text-white">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-sm font-mono tracking-widest text-neutral-400 uppercase">
          Drum Trainer
        </h1>
        <button
          onClick={signInWithGoogle}
          className="px-6 py-3 text-sm font-mono rounded border border-neutral-600 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
