'use client';

import { useState, useEffect, useMemo } from 'react';
import { LibraryEntry } from '@/types/music';
import { fetchLibrary } from '@/lib/tracks';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  onSelect: (entry: LibraryEntry) => void;
}

export default function TrackLibrary({ onSelect }: Props) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchLibrary()
      .then(setEntries)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return entries;
    return entries.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        e.artist.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-sm font-mono tracking-widest text-neutral-400 uppercase mb-3">
          Track Library
        </h2>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title or artist…"
          className="w-full max-w-sm px-3 py-2 text-sm bg-neutral-900 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-6 py-8 text-sm text-neutral-500">Loading…</p>
        )}
        {!loading && error && (
          <p className="px-6 py-8 text-sm text-red-400">
            Failed to load tracks: {error}
          </p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="px-6 py-8 text-sm text-neutral-500">
            {query ? 'No tracks match your search.' : 'No tracks yet.'}
          </p>
        )}
        {!loading &&
          !error &&
          filtered.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full text-left px-6 py-4 border-b border-neutral-800 hover:bg-neutral-900 transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-100 truncate group-hover:text-white">
                    {entry.title}
                  </p>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {entry.artist}
                    {entry.genre ? ` · ${entry.genre}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500 flex-shrink-0">
                  <span>{entry.bpm} BPM</span>
                  <span>{formatDuration(entry.duration_seconds)}</span>
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
