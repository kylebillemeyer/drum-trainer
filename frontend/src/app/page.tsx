'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { useAuth } from '@/context/AuthContext';
import { LibraryEntry } from '@/types/music';
import TrackLibrary from '@/components/TrackLibrary/TrackLibrary';

function HomeContent() {
  const { signOut, user } = useAuth();
  const router = useRouter();

  function handleSelectTrack(entry: LibraryEntry) {
    router.push(`/track/${entry.id}`);
  }

  return (
    <main className="flex flex-col h-screen bg-neutral-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
        <h1 className="text-sm font-mono tracking-widest text-neutral-400 uppercase">
          Drum Trainer
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/upload"
            className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            Upload
          </Link>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
            title={user?.email ?? 'Sign out'}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <TrackLibrary onSelect={handleSelectTrack} />
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}
