// ─── Domain Types ───────────────────────────────────────────────────────────

export type TrackType = 'audio' | 'midi' | 'instrument'

export interface Note {
  id: string
  pitch: number        // MIDI note number 0-127
  startBeat: number    // beat position (e.g. 0, 0.25, 0.5...)
  durationBeats: number
  velocity: number     // 0-127
}

export interface Clip {
  id: string
  trackId: string
  name: string
  startBeat: number
  durationBeats: number
  color?: string
  // MIDI clips
  notes?: Note[]
  // Audio clips
  audioUrl?: string
  audioBuffer?: AudioBuffer
}

export interface Track {
  id: string
  name: string
  type: TrackType
  color: string
  clips: Clip[]
  // Mixer
  volume: number   // 0-1
  pan: number      // -1 to +1
  muted: boolean
  solo: boolean
  armed: boolean   // record armed
  // Instrument / synth settings
  instrument?: InstrumentSettings
}

export interface InstrumentSettings {
  type: 'synth' | 'am-synth' | 'fm-synth' | 'membrane' | 'metal' | 'sampler'
  options?: Record<string, unknown>
}

export interface Project {
  id: string
  name: string
  bpm: number
  timeSignature: [number, number]
  tracks: Track[]
  sampleRate: number
  createdAt: string
  updatedAt: string
}

// ─── Playback / Transport ────────────────────────────────────────────────────

export interface TransportState {
  isPlaying: boolean
  isRecording: boolean
  currentBeat: number
  loopEnabled: boolean
  loopStart: number
  loopEnd: number
}

// ─── AI Generation ──────────────────────────────────────────────────────────

export type AIGenerationMode = 'beat' | 'loop' | 'melody' | 'chord-progression'

export interface AIGenerationRequest {
  mode: AIGenerationMode
  bpm: number
  bars: number
  style?: string
  seedMidi?: string      // base64 MIDI data
  seedAudio?: string     // base64 audio data
  key?: string
  scale?: string
  intensity?: number     // 0-1
}

export interface AIGenerationResult {
  trackId: string
  clipId: string
  notes: Note[]
  durationBeats: number
  metadata: {
    model: string
    prompt?: string
    generationTime: number
  }
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WSEventType =
  | 'project:update'
  | 'track:add'
  | 'track:update'
  | 'track:remove'
  | 'clip:add'
  | 'clip:update'
  | 'clip:remove'
  | 'transport:update'

export interface WSEvent<T = unknown> {
  type: WSEventType
  payload: T
  userId: string
  timestamp: number
}

// ─── API Response shapes ─────────────────────────────────────────────────────

export interface ApiProject {
  id: string
  name: string
  bpm: number
  time_signature_numerator: number
  time_signature_denominator: number
  created_at: string
  updated_at: string
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

// ─── MIDI Input ──────────────────────────────────────────────────────────────

export interface MIDIDeviceInfo {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export interface AnalysisResult {
  key: string
  scale: string
  tempo: number
  pattern: string
  notesSummary: string
}

export interface Suggestion {
  id: string
  name: string
  description: string
  type: 'continuation' | 'harmony' | 'chord-progression' | 'variation'
  notes: Note[]
  durationBeats: number
}
