'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TEST_TRACK } from '@/lib/testTrack';
import { parseMidi } from '@/lib/midiImport';
import { useTransport } from '@/lib/useTransport';
import { useMetronome } from '@/lib/useMetronome';
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

const TEMPO_STEPS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0];

export default function Home() {
  const [view, setView]                 = useState<ViewMode>('3d');
  const [track, setTrack]               = useState<DrumTrack>(TEST_TRACK);
  const [showLabels, setShowLabels]     = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [metronome, setMetronome]       = useState(false);
  const [preparing, setPreparing]       = useState(false); // true during pre-delay + count-in
  const [countBeat, setCountBeat]       = useState<number | null>(null);
  const [playedUpTo, setPlayedUpTo]     = useState(0); // furthest track position previously played
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pendingPlayRef = useRef(false);
  const resumeAtRef    = useRef(0);  // track time the highway will resume from after count-in
  const rewindRafRef   = useRef<number | null>(null);

  const { playing, rate, getCurrentTime, play, pause, setRate, transport } =
    useTransport();

  // Position transport at the count-in start whenever the track changes (incl. initial mount).
  // This means the highway always opens with notes visible in the distance.
  useEffect(() => {
    if (rewindRafRef.current !== null) {
      cancelAnimationFrame(rewindRafRef.current);
      rewindRafRef.current = null;
    }
    const countInDur = track.timeSignature[0] * (60 / track.bpm);
    resumeAtRef.current = 0;
    setPlayedUpTo(0);
    transport.seek(-countInDur);
  }, [track, transport]);

  function startRewind(from: number, to: number) {
    if (rewindRafRef.current !== null) cancelAnimationFrame(rewindRafRef.current);
    if (Math.abs(from - to) < 0.001) { transport.seek(to); return; }
    const REWIND_MS = 800;
    const startMs = performance.now();
    function step() {
      const progress = Math.min((performance.now() - startMs) / REWIND_MS, 1);
      transport.seek(from + (to - from) * progress);
      rewindRafRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    }
    rewindRafRef.current = requestAnimationFrame(step);
  }

  // countingIn = transport is running but we're still in the pre-roll bar
  const countingIn = preparing && playing;

  useMetronome(transport, track, metronome, playing, countingIn);

  // Poll transport during count-in, update the beat number displayed on screen
  useEffect(() => {
    if (!countingIn) {
      setCountBeat(null);
      return;
    }

    let rafId: number;
    const beatDur     = 60 / track.bpm;
    const countInDur  = track.timeSignature[0] * beatDur;
    const resumeAt    = resumeAtRef.current;
    const countInStart = resumeAt - countInDur;

    const poll = () => {
      const t = getCurrentTime();
      if (t >= resumeAt) {
        setPreparing(false);
        setCountBeat(null);
        return;
      }
      if (t >= countInStart) {
        const beat = Math.floor((t - countInStart) / beatDur) + 1;
        setCountBeat(Math.min(beat, track.timeSignature[0]));
      }
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [countingIn, getCurrentTime, track]);

  async function handlePlayPause() {
    if (preparing || playing) {
      pendingPlayRef.current = false;
      const pauseTime = transport.getTime();
      pause();
      setPreparing(false);
      setCountBeat(null);

      const beatDur    = 60 / track.bpm;
      const barDur     = track.timeSignature[0] * beatDur;
      const countInDur = barDur;
      // Align to the nearest past bar boundary so the count-in always starts on beat 1.
      // A beat-only floor would land mid-bar and give a non-zero beat index.
      // Max with 0 handles stop during the count-in itself.
      const resumeFrom = Math.max(Math.floor(pauseTime / barDur) * barDur, 0);
      resumeAtRef.current = resumeFrom;
      setPlayedUpTo(resumeFrom);
      startRewind(pauseTime, resumeFrom - countInDur);
      return;
    }

    setPreparing(true);
    pendingPlayRef.current = true;

    // 1-second pre-delay before count-in begins
    await new Promise<void>(r => setTimeout(r, 1000));
    if (!pendingPlayRef.current) return;

    // If the rewind is still running (user pressed play < 800ms after stop), snap to target
    if (rewindRafRef.current !== null) {
      cancelAnimationFrame(rewindRafRef.current);
      rewindRafRef.current = null;
      transport.seek(resumeAtRef.current - track.timeSignature[0] * (60 / track.bpm));
    }

    await play();
    // setPreparing stays true — rAF poll clears it once t >= resumeAt
  }

  function handleImportClick() {
    if (preparing || playing) {
      pendingPlayRef.current = false;
      pause();
      setPreparing(false);
      setCountBeat(null);
    }
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
            onClick={handlePlayPause}
            className="px-4 py-1.5 text-sm font-mono rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
          >
            {preparing || playing ? 'Stop' : 'Play'}
          </button>

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
          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
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
                    onClick={() => {
                      const idx = TEMPO_STEPS.indexOf(rate);
                      if (idx > 0) setRate(TEMPO_STEPS[idx - 1]);
                    }}
                    disabled={rate <= TEMPO_STEPS[0]}
                    className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
                  >
                    −
                  </button>
                  <span className="text-xs font-mono text-neutral-300 w-10 text-center">
                    {Math.round(rate * 100)}%
                  </span>
                  <button
                    onClick={() => {
                      const idx = TEMPO_STEPS.indexOf(rate);
                      if (idx < TEMPO_STEPS.length - 1) setRate(TEMPO_STEPS[idx + 1]);
                    }}
                    disabled={rate >= TEMPO_STEPS[TEMPO_STEPS.length - 1]}
                    className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30 text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── Count-in beat overlay ── */}
      {countBeat !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <span
            key={countBeat}
            className="beat-pop select-none"
            style={{
              fontSize: '22vw',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1,
            }}
          >
            {countBeat}
          </span>
        </div>
      )}

      {/* ── Highway ── */}
      <div className="flex-1">
        {view === 'flat'
          ? <DrumHighway   track={track} getCurrentTime={getCurrentTime} playedUpTo={playedUpTo} />
          : <DrumHighway3D track={track} getCurrentTime={getCurrentTime} playedUpTo={playedUpTo} showLabels={showLabels} />
        }
      </div>
    </main>
  );
}
