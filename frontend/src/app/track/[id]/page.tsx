'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TEST_TRACK } from '@/lib/testTrack';
import { getTrackById, loadTrack } from '@/lib/tracks';
import { useTransport } from '@/lib/useTransport';
import { useMetronome } from '@/lib/useMetronome';
import { DrumTrack } from '@/types/music';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { useAuth } from '@/context/AuthContext';
import { SettingsProvider, useSettings } from '@/lib/SettingsContext';
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel';

const DrumHighway = dynamic(
  () => import('@/components/DrumHighway/DrumHighway'),
  { ssr: false }
);

const DrumHighway3D = dynamic(
  () => import('@/components/DrumHighway3D/DrumHighway3D'),
  { ssr: false }
);

function TrackPageContent() {
  const { id } = useParams<{ id: string }>();
  const { signOut, user } = useAuth();
  const { view, showLabels, metronome, countInBars, preDelaySecs } = useSettings();

  const [track, setTrack]         = useState<DrumTrack>(TEST_TRACK);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [preparing, setPreparing]       = useState(false);
  const [countBeat, setCountBeat]       = useState<number | null>(null);
  const [playedUpTo, setPlayedUpTo]     = useState(0);
  const pendingPlayRef = useRef(false);
  const resumeAtRef    = useRef(0);
  const rewindRafRef   = useRef<number | null>(null);

  const { playing, rate, getCurrentTime, play, pause, setRate, transport } =
    useTransport();

  useEffect(() => {
    async function fetch() {
      try {
        const entry = await getTrackById(id);
        if (!entry) { setLoadError('Track not found.'); return; }
        const loaded = await loadTrack(entry);
        setTrack(loaded);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load track.');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  useEffect(() => {
    if (rewindRafRef.current !== null) {
      cancelAnimationFrame(rewindRafRef.current);
      rewindRafRef.current = null;
    }
    const countInDur = countInBars * track.timeSignature[0] * (60 / track.bpm);
    resumeAtRef.current = 0;
    setPlayedUpTo(0);
    transport.seek(-countInDur);
  }, [track, transport, countInBars]);

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

  const countingIn = preparing && playing;

  useMetronome(transport, track, metronome, playing, countingIn);

  useEffect(() => {
    if (!countingIn) { setCountBeat(null); return; }

    let rafId: number;
    const beatDur      = 60 / track.bpm;
    const countInDur   = countInBars * track.timeSignature[0] * beatDur;
    const resumeAt     = resumeAtRef.current;
    const countInStart = resumeAt - countInDur;

    const poll = () => {
      const t = getCurrentTime();
      if (t >= resumeAt) { setPreparing(false); setCountBeat(null); return; }
      if (t >= countInStart) {
        const beat = Math.floor((t - countInStart) / beatDur) + 1;
        setCountBeat(Math.min(beat, track.timeSignature[0]));
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [countingIn, countInBars, getCurrentTime, track]);

  async function handlePlayPause() {
    if (loading) return;
    if (preparing || playing) {
      pendingPlayRef.current = false;
      const pauseTime = transport.getTime();
      pause();
      setPreparing(false);
      setCountBeat(null);
      const beatDur    = 60 / track.bpm;
      const barDur     = track.timeSignature[0] * beatDur;
      const countInDur = countInBars * barDur;
      const resumeFrom = Math.max(Math.floor(pauseTime / barDur) * barDur, 0);
      resumeAtRef.current = resumeFrom;
      setPlayedUpTo(resumeFrom);
      startRewind(pauseTime, resumeFrom - countInDur);
      return;
    }

    setPreparing(true);
    pendingPlayRef.current = true;
    await new Promise<void>(r => setTimeout(r, preDelaySecs * 1000));
    if (!pendingPlayRef.current) return;

    if (rewindRafRef.current !== null) {
      cancelAnimationFrame(rewindRafRef.current);
      rewindRafRef.current = null;
      transport.seek(resumeAtRef.current - countInBars * track.timeSignature[0] * (60 / track.bpm));
    }
    await play();
  }

  return (
    <main className="flex flex-col h-screen bg-neutral-950 text-white">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
        <Link
          href="/"
          className="text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          ← Library
        </Link>

        {!loading && !loadError && (
          <>
            <span className="text-neutral-600">|</span>
            <span className="text-sm text-neutral-300">{track.title}</span>
            {track.artist && (
              <span className="text-xs text-neutral-500">{track.artist}</span>
            )}
            <span className="text-xs text-neutral-500">
              {track.bpm} BPM · {track.timeSignature.join('/')}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/upload"
            className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            Upload
          </Link>

          {!loading && !loadError && (
            <>
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
            </>
          )}

          <button
            onClick={signOut}
            className="px-3 py-1.5 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
            title={user?.email ?? 'Sign out'}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        rate={rate}
        setRate={setRate}
      />

      {/* ── Count-in overlay ── */}
      {countBeat !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <span key={countBeat} className="beat-pop select-none" style={{ fontSize: '22vw', fontFamily: 'monospace', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>
            {countBeat}
          </span>
        </div>
      )}

      {/* ── Main content ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
          Loading track…
        </div>
      )}
      {!loading && loadError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm">
          <p className="text-red-400">{loadError}</p>
          <Link href="/" className="text-neutral-400 hover:text-neutral-200 underline">← Back to library</Link>
        </div>
      )}
      {!loading && !loadError && (
        <div className="flex-1">
          {view === 'flat'
            ? <DrumHighway   track={track} getCurrentTime={getCurrentTime} playedUpTo={playedUpTo} />
            : <DrumHighway3D track={track} getCurrentTime={getCurrentTime} playedUpTo={playedUpTo} />
          }
        </div>
      )}
    </main>
  );
}

export default function TrackPage() {
  return (
    <AuthGate>
      <SettingsProvider>
        <TrackPageContent />
      </SettingsProvider>
    </AuthGate>
  );
}
