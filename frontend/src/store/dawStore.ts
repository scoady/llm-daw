import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Track, Clip, Note, TransportState, TrackType, MIDIDeviceInfo } from '@/types'

const TRACK_COLORS = [
  '#6c63ff', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316',
]

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function nextColor(tracks: Track[]): string {
  return TRACK_COLORS[tracks.length % TRACK_COLORS.length]
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface DAWState {
  // Project meta
  projectId: string | null
  projectName: string
  bpm: number
  timeSignature: [number, number]

  // Tracks
  tracks: Track[]
  selectedTrackId: string | null
  selectedClipId: string | null

  // Transport
  transport: TransportState

  // View
  pixelsPerBeat: number
  scrollLeft: number
  scrollTop: number
  totalBeats: number

  // Piano roll
  pianoRollOpen: boolean
  pianoRollClipId: string | null

  // MIDI input
  midiDevices: MIDIDeviceInfo[]
  selectedMidiDeviceId: string | null
  activeMidiNotes: number[]

  // Recording
  recordingStartBeat: number | null
  recordingClipId: string | null

  // AI Panel
  aiPanelOpen: boolean
}

interface DAWActions {
  // Project
  setProjectId(id: string): void
  setProjectName(name: string): void
  setBpm(bpm: number): void

  // Tracks
  addTrack(type: TrackType, name?: string): Track
  removeTrack(id: string): void
  updateTrack(id: string, patch: Partial<Track>): void
  selectTrack(id: string | null): void
  reorderTracks(fromIndex: number, toIndex: number): void

  // Clips
  addClip(trackId: string, startBeat: number, durationBeats?: number): Clip
  removeClip(trackId: string, clipId: string): void
  updateClip(trackId: string, clipId: string, patch: Partial<Clip>): void
  selectClip(id: string | null): void
  moveClip(clipId: string, newTrackId: string, newStartBeat: number): void

  // Notes (piano roll)
  addNote(clipId: string, note: Omit<Note, 'id'>): void
  removeNote(clipId: string, noteId: string): void
  updateNote(clipId: string, noteId: string, patch: Partial<Note>): void

  // Transport
  setPlaying(playing: boolean): void
  setRecording(recording: boolean): void
  setCurrentBeat(beat: number): void
  setLoop(start: number, end: number, enabled?: boolean): void

  // View
  setPixelsPerBeat(ppb: number): void
  setScrollLeft(x: number): void
  setScrollTop(y: number): void
  zoomIn(): void
  zoomOut(): void

  // Piano roll
  openPianoRoll(clipId: string): void
  closePianoRoll(): void

  // MIDI input
  setMidiDevices(devices: MIDIDeviceInfo[]): void
  selectMidiDevice(id: string | null): void
  setActiveMidiNotes(notes: number[]): void
  addActiveMidiNote(pitch: number): void
  removeActiveMidiNote(pitch: number): void

  // Recording
  startRecording(): void
  stopRecording(): void

  // AI Panel
  toggleAIPanel(): void
  setAIPanelOpen(open: boolean): void

  // Bulk hydrate (for project load)
  hydrate(state: Partial<DAWState>): void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useDAWStore = create<DAWState & DAWActions>()(
  immer((set, get) => ({
    // ── Initial state
    projectId: null,
    projectName: 'Untitled Project',
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [],
    selectedTrackId: null,
    selectedClipId: null,
    transport: {
      isPlaying: false,
      isRecording: false,
      currentBeat: 0,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: 8,
    },
    pixelsPerBeat: 40,
    scrollLeft: 0,
    scrollTop: 0,
    totalBeats: 128,
    pianoRollOpen: false,
    pianoRollClipId: null,

    // MIDI input
    midiDevices: [],
    selectedMidiDeviceId: null,
    activeMidiNotes: [],

    // Recording
    recordingStartBeat: null,
    recordingClipId: null,

    // AI Panel
    aiPanelOpen: false,

    // ── Project
    setProjectId: (id) => set((s) => { s.projectId = id }),
    setProjectName: (name) => set((s) => { s.projectName = name }),
    setBpm: (bpm) => set((s) => { s.bpm = Math.max(20, Math.min(300, bpm)) }),

    // ── Tracks
    addTrack: (type, name) => {
      const track: Track = {
        id: makeId(),
        name: name ?? `Track ${get().tracks.length + 1}`,
        type,
        color: nextColor(get().tracks),
        clips: [],
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        armed: false,
        instrument: type === 'midi' || type === 'instrument'
          ? { type: 'synth' }
          : undefined,
      }
      set((s) => { s.tracks.push(track) })
      return track
    },

    removeTrack: (id) => set((s) => {
      s.tracks = s.tracks.filter((t) => t.id !== id)
      if (s.selectedTrackId === id) s.selectedTrackId = null
    }),

    updateTrack: (id, patch) => set((s) => {
      const t = s.tracks.find((t) => t.id === id)
      if (t) Object.assign(t, patch)
    }),

    selectTrack: (id) => set((s) => { s.selectedTrackId = id }),

    reorderTracks: (from, to) => set((s) => {
      const [removed] = s.tracks.splice(from, 1)
      s.tracks.splice(to, 0, removed)
    }),

    // ── Clips
    addClip: (trackId, startBeat, durationBeats = 4) => {
      const clip: Clip = {
        id: makeId(),
        trackId,
        name: 'Clip',
        startBeat,
        durationBeats,
        notes: [],
      }
      set((s) => {
        const t = s.tracks.find((t) => t.id === trackId)
        if (t) t.clips.push(clip)
      })
      return clip
    },

    removeClip: (trackId, clipId) => set((s) => {
      const t = s.tracks.find((t) => t.id === trackId)
      if (t) t.clips = t.clips.filter((c) => c.id !== clipId)
      if (s.selectedClipId === clipId) s.selectedClipId = null
    }),

    updateClip: (trackId, clipId, patch) => set((s) => {
      const t = s.tracks.find((t) => t.id === trackId)
      const c = t?.clips.find((c) => c.id === clipId)
      if (c) Object.assign(c, patch)
    }),

    selectClip: (id) => set((s) => { s.selectedClipId = id }),

    moveClip: (clipId, newTrackId, newStartBeat) => set((s) => {
      let clip: Clip | undefined
      for (const t of s.tracks) {
        const idx = t.clips.findIndex((c) => c.id === clipId)
        if (idx !== -1) {
          clip = { ...t.clips[idx] }
          t.clips.splice(idx, 1)
          break
        }
      }
      if (clip) {
        clip.trackId = newTrackId
        clip.startBeat = newStartBeat
        const target = s.tracks.find((t) => t.id === newTrackId)
        target?.clips.push(clip)
      }
    }),

    // ── Notes
    addNote: (clipId, note) => set((s) => {
      for (const t of s.tracks) {
        const c = t.clips.find((c) => c.id === clipId)
        if (c) {
          if (!c.notes) c.notes = []
          c.notes.push({ ...note, id: makeId() })
          return
        }
      }
    }),

    removeNote: (clipId, noteId) => set((s) => {
      for (const t of s.tracks) {
        const c = t.clips.find((c) => c.id === clipId)
        if (c?.notes) {
          c.notes = c.notes.filter((n) => n.id !== noteId)
          return
        }
      }
    }),

    updateNote: (clipId, noteId, patch) => set((s) => {
      for (const t of s.tracks) {
        const c = t.clips.find((c) => c.id === clipId)
        const n = c?.notes?.find((n) => n.id === noteId)
        if (n) { Object.assign(n, patch); return }
      }
    }),

    // ── Transport
    setPlaying: (playing) => set((s) => { s.transport.isPlaying = playing }),
    setRecording: (rec) => set((s) => { s.transport.isRecording = rec }),
    setCurrentBeat: (beat) => set((s) => { s.transport.currentBeat = beat }),
    setLoop: (start, end, enabled) => set((s) => {
      s.transport.loopStart = start
      s.transport.loopEnd = end
      if (enabled !== undefined) s.transport.loopEnabled = enabled
    }),

    // ── View
    setPixelsPerBeat: (ppb) => set((s) => { s.pixelsPerBeat = Math.max(10, Math.min(200, ppb)) }),
    setScrollLeft: (x) => set((s) => { s.scrollLeft = Math.max(0, x) }),
    setScrollTop: (y) => set((s) => { s.scrollTop = Math.max(0, y) }),
    zoomIn:  () => set((s) => { s.pixelsPerBeat = Math.min(200, s.pixelsPerBeat * 1.25) }),
    zoomOut: () => set((s) => { s.pixelsPerBeat = Math.max(10,  s.pixelsPerBeat * 0.8)  }),

    // ── Piano roll
    openPianoRoll:  (clipId) => set((s) => { s.pianoRollOpen = true; s.pianoRollClipId = clipId }),
    closePianoRoll: ()       => set((s) => { s.pianoRollOpen = false; s.pianoRollClipId = null }),

    // ── MIDI input
    setMidiDevices: (devices) => set((s) => { s.midiDevices = devices }),
    selectMidiDevice: (id) => set((s) => { s.selectedMidiDeviceId = id }),
    setActiveMidiNotes: (notes) => set((s) => { s.activeMidiNotes = notes }),
    addActiveMidiNote: (pitch) => set((s) => {
      if (!s.activeMidiNotes.includes(pitch)) {
        s.activeMidiNotes.push(pitch)
      }
    }),
    removeActiveMidiNote: (pitch) => set((s) => {
      s.activeMidiNotes = s.activeMidiNotes.filter((n) => n !== pitch)
    }),

    // ── Recording
    startRecording: () => {
      const state = get()
      const armedTrack = state.tracks.find((t) => t.armed)
      if (!armedTrack) return

      const startBeat = state.transport.currentBeat
      const clip = state.addClip(armedTrack.id, startBeat, 0)

      set((s) => {
        s.transport.isRecording = true
        s.recordingStartBeat = startBeat
        s.recordingClipId = clip.id
      })
    },
    stopRecording: () => set((s) => {
      if (s.recordingClipId && s.recordingStartBeat !== null) {
        // Finalize clip duration based on current beat
        const duration = Math.max(1, s.transport.currentBeat - s.recordingStartBeat)
        for (const t of s.tracks) {
          const clip = t.clips.find((c) => c.id === s.recordingClipId)
          if (clip) {
            clip.durationBeats = Math.ceil(duration / 4) * 4 // snap to bar
            break
          }
        }
      }
      s.transport.isRecording = false
      s.recordingStartBeat = null
      s.recordingClipId = null
    }),

    // ── AI Panel
    toggleAIPanel: () => set((s) => { s.aiPanelOpen = !s.aiPanelOpen }),
    setAIPanelOpen: (open) => set((s) => { s.aiPanelOpen = open }),

    // ── Hydrate
    hydrate: (state) => set((s) => { Object.assign(s, state) }),
  }))
)

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectTrackById = (id: string) =>
  (s: DAWState) => s.tracks.find((t) => t.id === id)

export const selectClipById = (id: string) =>
  (s: DAWState): Clip | undefined => {
    for (const t of s.tracks) {
      const c = t.clips.find((c) => c.id === id)
      if (c) return c
    }
  }

export const selectSoloTracks = (s: DAWState) =>
  s.tracks.filter((t) => t.solo)
