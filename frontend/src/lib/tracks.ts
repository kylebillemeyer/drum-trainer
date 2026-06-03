import { supabase } from './supabase';
import { DrumTrack, LibraryEntry } from '@/types/music';
import { parseMidi } from './midiImport';

export async function fetchLibrary(): Promise<LibraryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tracks')
    .select('id, title, artist, genre, bpm, duration_seconds, midi_url, audio_url, uploader, uploaded_at')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadTrack(entry: LibraryEntry): Promise<DrumTrack> {
  const res = await fetch(entry.midi_url);
  if (!res.ok) throw new Error(`Failed to fetch MIDI: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  const track = parseMidi(buffer);
  return {
    ...track,
    title: entry.title,
    artist: entry.artist,
    genre: entry.genre ?? undefined,
  };
}
