import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Track, Clip, Note, TransportState, TrackType, MIDIDeviceInfo, Project, LibraryClip } from '@/types'
import { projectsApi } from '@/services/apiClient'
import { DEFAULT_PRESET_ID, migratePresetId } from '@/data/instrumentPresets'

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

  // Bottom panel
  bottomTab: 'mixer' | 'editor' | 'master' | 'keys'
  masterEQ: { low: number; mid: number; high: number }

  // MIDI input
  midiDevices: MIDIDeviceInfo[]
  selectedMidiDeviceId: string | null
  activeMidiNotes: number[]

  // Recording
  recordingStartBeat: number | null
  recordingClipId: string | null

  // Quantize
  quantizeGrid: number  // 1 = 1/4, 0.5 = 1/8, 0.25 = 1/16

  // AI Panel
  aiPanelOpen: boolean

  // Persistence
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: string | null
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
  setTrackInstrument(trackId: string, presetId: string): void

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
  quantizeClip(clipId: string, division: number): void
  setQuantizeGrid(division: number): void

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

  // Bottom panel
  setBottomTab(tab: 'mixer' | 'editor' | 'master' | 'keys'): void
  setMasterEQ(band: 'low' | 'mid' | 'high', value: number): void

  // MIDI input
  setMidiDevices(devices: MIDIDeviceInfo[]): void
  selectMidiDevice(id: string | null): void
  setActiveMidiNotes(notes: number[]): void
  addActiveMidiNote(pitch: number): void
  removeActiveMidiNote(pitch: number): void

  // Recording
  startRecording(): void
  stopRecording(): void
  updateRecordingDuration(currentBeat: number): void

  // AI Panel
  toggleAIPanel(): void
  setAIPanelOpen(open: boolean): void

  // Persistence
  saveProject(): Promise<void>
  loadProject(id: string): Promise<void>
  createProject(name: string, bpm?: number): Promise<string>

  // Library
  insertLibraryClip(clip: LibraryClip, trackId?: string): void

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

    // Bottom panel
    bottomTab: 'mixer' as const,
    masterEQ: { low: 0, mid: 0, high: 0 },

    // MIDI input
    midiDevices: [],
    selectedMidiDeviceId: null,
    activeMidiNotes: [],

    // Recording
    recordingStartBeat: null,
    recordingClipId: null,

    // Quantize
    quantizeGrid: 0.5,

    // AI Panel
    aiPanelOpen: false,

    // Persistence
    saveStatus: 'idle',
    lastSavedAt: null,

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
          ? { presetId: DEFAULT_PRESET_ID }
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

    setTrackInstrument: (trackId, presetId) => set((s) => {
      const t = s.tracks.find((t) => t.id === trackId)
      if (t) {
        if (!t.instrument) t.instrument = { presetId }
        else t.instrument.presetId = presetId
      }
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

    quantizeClip: (clipId, division) => set((s) => {
      for (const t of s.tracks) {
        const c = t.clips.find((c) => c.id === clipId)
        if (c?.notes) {
          for (const n of c.notes) {
            n.startBeat = Math.round(n.startBeat / division) * division
            n.durationBeats = Math.max(division, Math.round(n.durationBeats / division) * division)
          }
          return
        }
      }
    }),

    setQuantizeGrid: (division) => set((s) => { s.quantizeGrid = division }),

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
    openPianoRoll:  (clipId) => set((s) => { s.pianoRollOpen = true; s.pianoRollClipId = clipId; s.bottomTab = 'editor' }),
    closePianoRoll: ()       => set((s) => { s.pianoRollOpen = false; s.pianoRollClipId = null }),

    // ── Bottom panel
    setBottomTab: (tab) => set((s) => { s.bottomTab = tab }),
    setMasterEQ: (band, value) => set((s) => { s.masterEQ[band] = value }),

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
      const clip = state.addClip(armedTrack.id, startBeat, 4)

      set((s) => {
        s.transport.isRecording = true
        s.recordingStartBeat = startBeat
        s.recordingClipId = clip.id
      })
    },
    stopRecording: () => set((s) => {
      if (s.recordingClipId && s.recordingStartBeat !== null) {
        // Finalize clip duration snapped to bar
        const duration = Math.max(1, s.transport.currentBeat - s.recordingStartBeat)
        for (const t of s.tracks) {
          const clip = t.clips.find((c) => c.id === s.recordingClipId)
          if (clip) {
            clip.durationBeats = Math.ceil(duration / 4) * 4
            break
          }
        }
      }
      s.transport.isRecording = false
      s.recordingStartBeat = null
      s.recordingClipId = null
    }),
    updateRecordingDuration: (currentBeat) => set((s) => {
      if (!s.recordingClipId || s.recordingStartBeat === null) return
      const elapsed = currentBeat - s.recordingStartBeat
      // Grow clip in 4-beat increments as recording progresses
      const needed = Math.ceil(Math.max(4, elapsed + 1) / 4) * 4
      for (const t of s.tracks) {
        const clip = t.clips.find((c) => c.id === s.recordingClipId)
        if (clip && clip.durationBeats < needed) {
          clip.durationBeats = needed
          break
        }
      }
    }),

    // ── AI Panel
    toggleAIPanel: () => set((s) => { s.aiPanelOpen = !s.aiPanelOpen }),
    setAIPanelOpen: (open) => set((s) => { s.aiPanelOpen = open }),

    // ── Persistence
    saveProject: async () => {
      const state = get()
      if (!state.projectId || state.projectId === 'new') return

      set((s) => { s.saveStatus = 'saving' })
      try {
        const project: Project = {
          id: state.projectId,
          name: state.projectName,
          bpm: state.bpm,
          timeSignature: state.timeSignature,
          sampleRate: 44100,
          tracks: state.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => ({
              ...c,
              audioBuffer: undefined,
            })),
          })),
          createdAt: '',
          updatedAt: '',
        }
        await projectsApi.save(state.projectId, project)
        set((s) => {
          s.saveStatus = 'saved'
          s.lastSavedAt = new Date().toISOString()
        })
      } catch {
        set((s) => { s.saveStatus = 'error' })
      }
    },

    loadProject: async (id) => {
      try {
        const project = await projectsApi.get(id)
        set((s) => {
          s.projectId = project.id
          s.projectName = project.name
          s.bpm = project.bpm
          s.timeSignature = project.timeSignature ?? [4, 4]
          s.tracks = (project.tracks ?? []).map((t) => ({
            ...t,
            instrument: t.instrument
              ? { ...t.instrument, presetId: migratePresetId(t.instrument) }
              : (t.type === 'midi' || t.type === 'instrument')
                ? { presetId: DEFAULT_PRESET_ID }
                : undefined,
          }))
          s.selectedTrackId = null
          s.selectedClipId = null
          s.saveStatus = 'saved'
          s.lastSavedAt = project.updatedAt
        })
      } catch {
        // Project not found or API error — start fresh
        set((s) => { s.saveStatus = 'idle' })
      }
    },

    createProject: async (name, bpm = 120) => {
      const project = await projectsApi.create({ name, bpm })
      set((s) => {
        s.projectId = project.id
        s.projectName = project.name
        s.bpm = project.bpm
        s.timeSignature = [4, 4]
        s.tracks = []
        s.selectedTrackId = null
        s.selectedClipId = null
        s.saveStatus = 'saved'
        s.lastSavedAt = project.createdAt
      })
      return project.id
    },

    // ── Library
    insertLibraryClip: (libClip, trackId) => {
      const state = get()
      const targetId = trackId ?? state.selectedTrackId ?? state.tracks[0]?.id
      if (!targetId) return

      const track = state.tracks.find((t) => t.id === targetId)
      if (!track) return

      const startBeat = state.transport.currentBeat
      const clip: Clip = {
        id: makeId(),
        trackId: targetId,
        name: libClip.name,
        startBeat,
        durationBeats: libClip.durationBeats,
        color: libClip.color,
        notes: libClip.clipType === 'midi' && libClip.notes
          ? libClip.notes.map((n) => ({ ...n, id: makeId() }))
          : undefined,
        audioUrl: libClip.clipType === 'audio' && libClip.audioFileId
          ? `/api/audio/${libClip.audioFileId}`
          : undefined,
      }

      set((s) => {
        const t = s.tracks.find((t) => t.id === targetId)
        if (t) t.clips.push(clip)
      })
    },

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

// ─── Auto-save (debounced 2s after changes) ─────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastTracksJson = ''

useDAWStore.subscribe((state) => {
  const { projectId, transport } = state
  // Don't auto-save if no project, during recording, or while playing
  if (!projectId || projectId === 'new' || transport.isRecording || transport.isPlaying) return

  // Only trigger save when tracks/name/bpm actually changed
  const tracksJson = JSON.stringify({ t: state.tracks, n: state.projectName, b: state.bpm })
  if (tracksJson === lastTracksJson) return
  lastTracksJson = tracksJson

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    useDAWStore.getState().saveProject()
  }, 2000)
})
