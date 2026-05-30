'use client';

import { useSettings } from '@/lib/SettingsContext';

const TEMPO_MIN  = 0.30;
const TEMPO_MAX  = 2.00;
const TEMPO_STEP = 0.05;

interface Props {
  open: boolean;
  onClose: () => void;
  rate: number;
  setRate: (r: number) => void;
}

export default function SettingsPanel({ open, onClose, rate, setRate }: Props) {
  const { view, setView, showLabels, setShowLabels, metronome, setMetronome, countInBars, setCountInBars, preDelaySecs, setPreDelaySecs } = useSettings();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-14 right-4 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-56">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Settings</span>
          <button
            onClick={onClose}
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
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showLabels ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </label>

          {/* Metronome */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-neutral-300">Metronome</span>
            <button
              role="switch"
              aria-checked={metronome}
              onClick={() => setMetronome(m => !m)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${metronome ? 'bg-neutral-400' : 'bg-neutral-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${metronome ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </label>

          {/* Tempo */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-300">Tempo</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRate(Math.max(TEMPO_MIN, parseFloat((rate - TEMPO_STEP).toFixed(2))))}
                disabled={rate <= TEMPO_MIN}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                −
              </button>
              <span className="text-xs font-mono text-neutral-300 w-10 text-center">
                {Math.round(rate * 100)}%
              </span>
              <button
                onClick={() => setRate(Math.min(TEMPO_MAX, parseFloat((rate + TEMPO_STEP).toFixed(2))))}
                disabled={rate >= TEMPO_MAX}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Count-in bars */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-300">Count-in</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCountInBars(b => Math.max(1, b - 1))}
                disabled={countInBars <= 1}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                −
              </button>
              <span className="text-xs font-mono text-neutral-300 w-10 text-center">
                {countInBars} {countInBars === 1 ? 'bar' : 'bars'}
              </span>
              <button
                onClick={() => setCountInBars(b => Math.min(4, b + 1))}
                disabled={countInBars >= 4}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Pre-delay */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-300">Pre-delay</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreDelaySecs(s => Math.max(0, s - 1))}
                disabled={preDelaySecs <= 0}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                −
              </button>
              <span className="text-xs font-mono text-neutral-300 w-10 text-center">
                {preDelaySecs}s
              </span>
              <button
                onClick={() => setPreDelaySecs(s => Math.min(3, s + 1))}
                disabled={preDelaySecs >= 3}
                className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
              >
                +
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
