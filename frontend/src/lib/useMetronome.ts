'use client';

import { useEffect, useRef } from 'react';
import { Metronome } from './metronome';
import { Transport } from './transport';
import { DrumTrack } from '@/types/music';

export function useMetronome(
  transport: Transport,
  track: DrumTrack,
  enabled: boolean,
  playing: boolean,
  countingIn: boolean,
): void {
  const metronomeRef = useRef<Metronome | null>(null);

  useEffect(() => {
    metronomeRef.current = new Metronome(transport, track.bpm, track.timeSignature);
    return () => {
      metronomeRef.current?.stop();
      metronomeRef.current = null;
    };
  }, [transport, track]);

  useEffect(() => {
    const m = metronomeRef.current;
    if (!m) return;
    // Always click during count-in; respect the enabled toggle otherwise
    if ((enabled || countingIn) && playing) {
      m.start();
    } else {
      m.stop();
    }
  }, [enabled, playing, countingIn]);
}
