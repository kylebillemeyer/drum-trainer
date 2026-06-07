'use client';

/**
 * useAudioPlayer — pitch-preserving backing track, locked to Transport.
 *
 * Domain concept
 * --------------
 * An HTMLAudioElement with preservesPitch=true gives Chrome's native
 * time-stretch at any playbackRate, keeping the audio in tune at 30–200%.
 *
 * Sync model
 * ----------
 * When the transport starts playing, the audio is scheduled to begin at
 * track-time `resumeAt` (bar boundary, 0 on first play).  The delay is
 * calculated from transport.trackTimeToCtxTime() so the audio start is
 * locked to the AudioContext clock — the same clock the MIDI highway and
 * metronome use.
 *
 * A drift-correction loop runs every ~60 animation frames (~1 s at 60 fps)
 * and re-seeks the audio element if it has strayed more than 50 ms from
 * transport.getTime().
 *
 * Rate changes
 * ------------
 * The effect depends on `rate`, so it re-runs when the user changes tempo:
 *  • During count-in (audio paused): old schedule is cancelled and a new
 *    start time is computed with the updated rate.
 *  • While playing: audio.playbackRate is updated and drift is corrected.
 *
 * Tracks without audio
 * --------------------
 * Pass audioUrl=null; the hook is a no-op.
 */

import { MutableRefObject, useEffect, useRef } from 'react';
import { Transport } from './transport';

export function useAudioPlayer(
  transport: Transport,
  audioUrl: string | null,
  resumeAtRef: MutableRefObject<number>,
  playing: boolean,
  rate: number,
): void {
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const startTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRafRef       = useRef<number | null>(null);

  // Create (or destroy) the audio element when the URL changes.
  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.preservesPitch = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  // Control playback.  Re-runs when playing or rate changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function clearSchedule(): void {
      if (startTimeoutRef.current !== null) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    }

    function startSyncLoop(): void {
      let frame = 0;
      function loop(): void {
        const a = audioRef.current;
        if (!a || !transport.isPlaying()) return;
        frame++;
        if (frame % 60 === 0) {
          const drift = Math.abs(a.currentTime - transport.getTime());
          if (drift > 0.05) {
            a.currentTime = transport.getTime();
          }
        }
        syncRafRef.current = requestAnimationFrame(loop);
      }
      syncRafRef.current = requestAnimationFrame(loop);
    }

    if (!playing) {
      clearSchedule();
      audio.pause();
      return;
    }

    // If audio is already playing (past count-in), just sync rate and drift.
    if (!audio.paused) {
      clearSchedule();
      audio.playbackRate = rate;
      const drift = Math.abs(audio.currentTime - transport.getTime());
      if (drift > 0.05) {
        audio.currentTime = transport.getTime();
      }
      startSyncLoop();
      return clearSchedule;
    }

    // Audio not yet playing — schedule it to start at resumeAt track time.
    const resumeAt = resumeAtRef.current;
    const ctx = transport.audioContext;
    const ctxAtResumeAt = transport.trackTimeToCtxTime(resumeAt);
    const delayMs = Math.max(0, (ctxAtResumeAt - ctx.currentTime) * 1000);

    audio.currentTime = resumeAt;
    audio.playbackRate = rate;

    startTimeoutRef.current = setTimeout(() => {
      startTimeoutRef.current = null;
      audio.play().catch(() => {
        // Autoplay blocked — backing track silent but MIDI highway continues.
      });
      startSyncLoop();
    }, delayMs);

    return clearSchedule;
  // resumeAtRef is intentionally omitted — it is a stable ref, read inside
  // the effect at the moment playing transitions to true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, rate, transport]);
}
