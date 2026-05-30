'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Settings = {
  view: 'flat' | '3d';
  setView: (v: 'flat' | '3d') => void;
  showLabels: boolean;
  setShowLabels: (v: boolean | ((prev: boolean) => boolean)) => void;
  metronome: boolean;
  setMetronome: (v: boolean | ((prev: boolean) => boolean)) => void;
  countInBars: number;
  setCountInBars: (v: number | ((prev: number) => number)) => void;
  preDelaySecs: number;
  setPreDelaySecs: (v: number | ((prev: number) => number)) => void;
};

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<'flat' | '3d'>('3d');
  const [showLabels, setShowLabels] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [countInBars, setCountInBars] = useState(1);
  const [preDelaySecs, setPreDelaySecs] = useState(1);

  return (
    <SettingsContext.Provider value={{
      view, setView,
      showLabels, setShowLabels,
      metronome, setMetronome,
      countInBars, setCountInBars,
      preDelaySecs, setPreDelaySecs,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
