'use client';

import { AuthGate } from '@/components/AuthGate';
import { UploadForm } from '@/components/UploadForm/UploadForm';
import Link from 'next/link';

export default function UploadPage() {
  return (
    <AuthGate>
      <main className="h-screen overflow-y-auto bg-neutral-950 text-white">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
          <Link
            href="/"
            className="text-sm font-mono tracking-widest text-neutral-400 uppercase hover:text-neutral-200 transition-colors"
          >
            Drum Trainer
          </Link>
          <span className="text-neutral-600">|</span>
          <span className="text-sm text-neutral-400 font-mono">Upload Track</span>
        </div>
        <div className="px-8 py-8">
          <h2 className="text-lg font-mono text-neutral-200 mb-6">Publish a track</h2>
          <UploadForm />
        </div>
      </main>
    </AuthGate>
  );
}
