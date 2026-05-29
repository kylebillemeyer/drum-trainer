'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TEST_TRACK } from '@/lib/testTrack';
import { parseMidi } from '@/lib/midiImport';
import { DrumTrack } from '@/types/music';

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
  const [playing, setPlaying]       = useState(false);
  const [view, setView]             = useState<ViewMode>('3d');
  const [track, setTrack]           = useState<DrumTrack>(TEST_TRACK);
  const [showLabels, setShowLabels] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImportClick() {
    setPlaying(false);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    try {
      setTrack(parseMidi(buffer));
    } catch (err) {
      console.error('Failed to parse MIDI file:', err);
      alert('Could not parse MIDI file. Make sure it is a valid .mid file.');
    }
    e.target.value = '';
  }

  return (
    <main className="flex flex-col h-screen bg-neutral-950 text-white">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
        <h1 className="text-sm font-mono tracking-widest text-neutral-400 uppercase">
          Drum Trainer
        </h1>
        <span className="text-neutral-600">|</span>
        <span className="text-sm text-neutral-300">{track.title}</span>
        <span className="text-xs text-neutral-500">
          {track.bpm} BPM · {track.timeSignature.join('/')}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            Import MIDI
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => setPlaying(p => !p)}
            className="px-4 py-1.5 text-sm font-mono rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`h-8 w-8 flex items-center justify-center rounded border transition-colors ${showSettings ? 'border-neutral-500 bg-neutral-700 text-white' : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            aria-label="Settings"
          >
            <span className="text-xl leading-none">⚙</span>
          </button>
        </div>
      </div>

      {/* ── Settings modal ── */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="fixed top-14 right-4 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-56">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Settings</span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-neutral-500 hover:text-neutral-300 text-sm leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {/* View mode */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">View</span>
                <div className="flex rounded overflow-hidden border border-neutral-700 text-xs font-mono">
                  <button
                    onClick={() => setView('flat')}
                    className={`px-3 py-1 transition-colors ${view === 'flat' ? 'bg-neutral-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}
                  >
                    Flat
                  </button>
                  <button
                    onClick={() => setView('3d')}
                    className={`px-3 py-1 transition-colors ${view === '3d' ? 'bg-neutral-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}
                  >
                    3D
                  </button>
                </div>
              </div>

              {/* Lane labels */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-neutral-300">Lane labels</span>
                <button
                  role="switch"
                  aria-checked={showLabels}
                  onClick={() => setShowLabels(l => !l)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${showLabels ? 'bg-neutral-400' : 'bg-neutral-700'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showLabels ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </label>
            </div>
          </div>
        </>
      )}

      {/* ── Highway ── */}
      <div className="flex-1">
        {view === 'flat'
          ? <DrumHighway   track={track} playing={playing} />
          : <DrumHighway3D track={track} playing={playing} showLabels={showLabels} />
        }
      </div>
    </main>
  );
}
