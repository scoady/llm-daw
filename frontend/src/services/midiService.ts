/**
 * MIDI Service — handles MIDI file parsing, export, and WebMIDI device access.
 */
import { Midi } from '@tonejs/midi'
import type { Note, Clip, Track } from '@/types'

// ─── Parse a MIDI file into our Note format ───────────────────────────────────
export async function parseMidiFile(file: File): Promise<{ notes: Note[]; bpm: number; durationBeats: number }> {
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)

  const bpm = midi.header.tempos[0]?.bpm ?? 120
  const ppq = midi.header.ppq

  const notes: Note[] = []
  let maxEnd = 0

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const startBeat = (note.ticks / ppq)
      const durationBeats = (note.durationTicks / ppq)
      notes.push({
        id: Math.random().toString(36).slice(2),
        pitch: note.midi,
        startBeat,
        durationBeats,
        velocity: note.velocity * 127,
      })
      maxEnd = Math.max(maxEnd, startBeat + durationBeats)
    }
  }

  return { notes, bpm, durationBeats: Math.ceil(maxEnd) }
}

// ─── Export a clip to MIDI file ───────────────────────────────────────────────
export function exportClipToMidi(clip: Clip, bpm: number): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(bpm)

  const track = midi.addTrack()
  const ppq = midi.header.ppq

  for (const note of clip.notes ?? []) {
    track.addNote({
      midi: note.pitch,
      ticks: Math.round(note.startBeat * ppq),
      durationTicks: Math.round(note.durationBeats * ppq),
      velocity: note.velocity / 127,
    })
  }

  return midi.toArray()
}

// ─── Export full project to MIDI ──────────────────────────────────────────────
export function exportProjectToMidi(tracks: Track[], bpm: number): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(bpm)

  for (const track of tracks) {
    if (track.type !== 'midi' && track.type !== 'instrument') continue
    const midiTrack = midi.addTrack()
    midiTrack.name = track.name
    const ppq = midi.header.ppq

    for (const clip of track.clips) {
      for (const note of clip.notes ?? []) {
        midiTrack.addNote({
          midi: note.pitch,
          ticks: Math.round((clip.startBeat + note.startBeat) * ppq),
          durationTicks: Math.round(note.durationBeats * ppq),
          velocity: note.velocity / 127,
        })
      }
    }
  }

  return midi.toArray()
}

// ─── Convert MIDI bytes to base64 ────────────────────────────────────────────
export function midiToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

// ─── Convert base64 to MIDI notes ────────────────────────────────────────────
export function base64ToNotes(b64: string): Note[] {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const midi = new Midi(bytes.buffer)
  const ppq = midi.header.ppq
  const notes: Note[] = []

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        id: Math.random().toString(36).slice(2),
        pitch: note.midi,
        startBeat: note.ticks / ppq,
        durationBeats: note.durationTicks / ppq,
        velocity: note.velocity * 127,
      })
    }
  }

  return notes
}

// ─── MIDI note number ↔ name helpers ─────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_NAMES[midi % 12]
  return `${name}${octave}`
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/)
  if (!match) return 60
  const noteIdx = NOTE_NAMES.indexOf(match[1])
  const octave = parseInt(match[2])
  return (octave + 1) * 12 + noteIdx
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}
