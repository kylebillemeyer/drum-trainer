'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { TEST_TRACK } from '@/lib/testTrack';

// PixiJS touches the DOM — load client-side only
const DrumHighway = dynamic(
  () => import('@/components/DrumHighway/DrumHighway'),
  { ssr: false }
);

export default function Home() {
  const [playing, setPlaying] = useState(false);

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
        <button
          onClick={() => setPlaying(p => !p)}
          className="ml-auto px-4 py-1.5 text-sm font-mono rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="flex-1">
        <DrumHighway track={TEST_TRACK} playing={playing} />
      </div>
    </main>
  );
}
