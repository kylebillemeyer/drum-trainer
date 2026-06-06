'use client';

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { Midi } from '@tonejs/midi';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const GENRES = ['Rock', 'Jazz', 'Metal', 'Pop', 'Latin'] as const;

interface FormState {
  title: string;
  artist: string;
  description: string;
  genre: string;
  bpm: string;
}

const EMPTY_FORM: FormState = { title: '', artist: '', description: '', genre: '', bpm: '' };

export function UploadForm() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const midiRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  function handleField(field: keyof FormState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleMidiChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setMidiFile(file);
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const midi = new Midi(buffer);
      const bpm = midi.header.tempos[0]?.bpm;
      if (bpm) setForm(f => ({ ...f, bpm: String(Math.round(bpm)) }));
    } catch {
      // MIDI parse failed — leave BPM field for manual entry
    }
  }

  function handleAudioChange(e: ChangeEvent<HTMLInputElement>) {
    setAudioFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !midiFile) return;
    setSubmitting(true);
    setError(null);

    try {
      const userId = user.id;
      const midiExt = midiFile.name.endsWith('.midi') ? 'midi' : 'mid';
      const midiPath = `midi/${userId}/${crypto.randomUUID()}.${midiExt}`;

      const { error: midiErr } = await supabase.storage
        .from('tracks')
        .upload(midiPath, midiFile, { contentType: 'audio/midi' });
      if (midiErr) throw new Error(`MIDI upload failed: ${midiErr.message}`);

      const { data: midiUrlData } = supabase.storage.from('tracks').getPublicUrl(midiPath);
      const midiUrl = midiUrlData.publicUrl;

      let audioUrl: string | null = null;
      if (audioFile) {
        const audioExt = audioFile.name.split('.').pop() ?? 'mp3';
        const audioPath = `audio/${userId}/${crypto.randomUUID()}.${audioExt}`;
        const { error: audioErr } = await supabase.storage
          .from('tracks')
          .upload(audioPath, audioFile);
        if (audioErr) throw new Error(`Audio upload failed: ${audioErr.message}`);
        const { data: audioUrlData } = supabase.storage.from('tracks').getPublicUrl(audioPath);
        audioUrl = audioUrlData.publicUrl;
      }

      const { error: dbErr } = await supabase.from('tracks').insert({
        title: form.title.trim(),
        artist: form.artist.trim(),
        description: form.description.trim() || null,
        genre: form.genre || null,
        bpm: parseInt(form.bpm, 10),
        midi_url: midiUrl,
        audio_url: audioUrl,
        uploader: userId,
      });
      if (dbErr) throw new Error(`Save failed: ${dbErr.message}`);

      setForm(EMPTY_FORM);
      setMidiFile(null);
      setAudioFile(null);
      if (midiRef.current) midiRef.current.value = '';
      if (audioRef.current) audioRef.current.value = '';
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-neutral-200 text-lg font-mono">Track published!</p>
        <p className="text-neutral-500 text-sm">Your track is live in the library.</p>
        <button
          onClick={() => setSuccess(false)}
          className="px-4 py-2 text-sm font-mono rounded border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          Upload another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      {error && (
        <p className="px-3 py-2 rounded bg-red-950 border border-red-800 text-red-300 text-sm font-mono">
          {error}
        </p>
      )}

      <Field label="Title" required>
        <input
          type="text"
          value={form.title}
          onChange={handleField('title')}
          required
          className={inputCls}
          placeholder="Song or exercise name"
        />
      </Field>

      <Field label="Artist" required>
        <input
          type="text"
          value={form.artist}
          onChange={handleField('artist')}
          required
          className={inputCls}
          placeholder="Original artist or creator"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={handleField('description')}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Short description shown in the library"
        />
      </Field>

      <Field label="Genre">
        <select value={form.genre} onChange={handleField('genre')} className={inputCls}>
          <option value="">Select genre</option>
          {GENRES.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Field>

      <Field label="MIDI file" required>
        <input
          ref={midiRef}
          type="file"
          accept=".mid,.midi"
          onChange={handleMidiChange}
          required
          className={fileCls}
        />
      </Field>

      <Field label="BPM" required>
        <input
          type="number"
          value={form.bpm}
          onChange={handleField('bpm')}
          required
          min={20}
          max={400}
          className={inputCls}
          placeholder="Auto-populated from MIDI"
        />
      </Field>

      <Field label="Audio file (optional)">
        <input
          ref={audioRef}
          type="file"
          accept=".mp3,.wav"
          onChange={handleAudioChange}
          className={fileCls}
        />
        <span className="text-xs text-neutral-600 mt-1">MP3 or WAV — omit to publish as MIDI-only exercise</span>
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="self-start px-5 py-2 text-sm font-mono rounded bg-neutral-700 text-neutral-100 hover:bg-neutral-600 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Uploading…' : 'Publish track'}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors';

const fileCls =
  'text-sm text-neutral-400 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-neutral-700 file:bg-neutral-900 file:text-neutral-400 file:text-xs file:font-mono hover:file:bg-neutral-800 transition-colors';
