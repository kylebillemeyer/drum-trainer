'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { TEST_TRACK } from '@/lib/testTrack';

const DrumHighway = dynamic(
  () => import('@/components/DrumHighway/DrumHighway'),
  { ssr: false }
);

const DrumHighway3D = dynamic(
  () => import('@/components/DrumHighway3D/DrumHighway3D'),
  { ssr: false }
);

type ViewMode = 'flat' | '3d';

export default function Home() {
  const [playing, setPlaying]   = useState(false);
  const [view, setView]         = useState<ViewMode>('3d');

  return (
    <main className="flex flex-col h-screen bg-neutral-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
        <h1 className="text-sm font-mono tracking-widest text-neutral-400 uppercase">
          Drum Trainer
        </h1>
        <span className="text-neutral-600">|</span>
        <span className="text-sm text-neutral-300">{TEST_TRACK.title}</span>
        <span className="text-xs text-neutral-500">
          {TEST_TRACK.bpm} BPM · {TEST_TRACK.timeSignature.join('/')}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-neutral-700 text-xs font-mono">
            <button
              onClick={() => setView('flat')}
              className={`px-3 py-1.5 transition-colors ${view === 'flat' ? 'bg-neutral-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}
            >
              Flat
            </button>
            <button
              onClick={() => setView('3d')}
              className={`px-3 py-1.5 transition-colors ${view === '3d' ? 'bg-neutral-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}
            >
              3D
            </button>
          </div>
          <button
            onClick={() => setPlaying(p => !p)}
            className="px-4 py-1.5 text-sm font-mono rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      <div className="flex-1">
        {view === 'flat'
          ? <DrumHighway   track={TEST_TRACK} playing={playing} />
          : <DrumHighway3D track={TEST_TRACK} playing={playing} />
        }
      </div>
    </main>
  );
}
