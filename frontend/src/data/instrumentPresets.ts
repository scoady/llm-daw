/**
 * Instrument Preset Library — curated synth presets for Tone.js.
 *
 * Each preset maps to a Tone.js synth type with specific parameters.
 * The `polyphonic` flag indicates whether it can be wrapped in PolySynth.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SynthType =
  | 'Synth'
  | 'AMSynth'
  | 'FMSynth'
  | 'MonoSynth'
  | 'DuoSynth'
  | 'MembraneSynth'
  | 'MetalSynth'
  | 'PluckSynth'
  | 'NoiseSynth'
  | 'Sampler'

export type PresetCategory =
  | 'keys'
  | 'leads'
  | 'pads'
  | 'bass'
  | 'plucked'
  | 'bells'
  | 'drums'
  | 'fx'

export interface InstrumentPreset {
  id: string
  name: string
  category: PresetCategory
  icon: string
  synthType: SynthType
  polyphonic: boolean
  synthOptions: Record<string, unknown>
  previewNote?: number   // MIDI note for preview (default 60)
  sampleMap?: Record<number, string>  // MIDI pitch → sample filename (for Sampler type)
  baseUrl?: string                     // base path for samples (for Sampler type)
}

export interface PresetCategoryMeta {
  id: PresetCategory
  label: string
  icon: string   // lucide icon name
  color: string
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const PRESET_CATEGORIES: PresetCategoryMeta[] = [
  { id: 'keys',    label: 'Keys',    icon: 'piano',       color: '#6c63ff' },
  { id: 'leads',   label: 'Leads',   icon: 'zap',         color: '#39ff14' },
  { id: 'pads',    label: 'Pads',    icon: 'cloud',       color: '#00d4ff' },
  { id: 'bass',    label: 'Bass',    icon: 'waves',       color: '#ff9f1c' },
  { id: 'plucked', label: 'Plucked', icon: 'guitar',      color: '#ff6bd6' },
  { id: 'bells',   label: 'Bells',   icon: 'bell',        color: '#4a90ff' },
  { id: 'drums',   label: 'Drums',   icon: 'drum',        color: '#ff2e63' },
  { id: 'fx',      label: 'FX',      icon: 'sparkles',    color: '#e6e600' },
]

// ─── Presets ──────────────────────────────────────────────────────────────────

export const PRESETS: InstrumentPreset[] = [
  // ── Keys ────────────────────────────────────────────────────────────────────
  {
    id: 'classic-piano',
    name: 'Classic Piano',
    category: 'keys',
    icon: '🎹',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.2 },
    },
  },
  {
    id: 'electric-piano',
    name: 'Electric Piano',
    category: 'keys',
    icon: '🎹',
    synthType: 'FMSynth',
    polyphonic: true,
    synthOptions: {
      harmonicity: 3.01,
      modulationIndex: 14,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 1 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
    },
  },
  {
    id: 'organ',
    name: 'Organ',
    category: 'keys',
    icon: '🎵',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'sine4' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.9, release: 0.1 },
    },
  },
  {
    id: 'clavinet',
    name: 'Clavinet',
    category: 'keys',
    icon: '🎶',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.15 },
    },
  },
  {
    id: 'harpsichord',
    name: 'Harpsichord',
    category: 'keys',
    icon: '🎼',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.05, release: 0.3 },
    },
  },

  // ── Leads ───────────────────────────────────────────────────────────────────
  {
    id: 'triangle-lead',
    name: 'Triangle Lead',
    category: 'leads',
    icon: '🔺',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
    },
  },
  {
    id: 'saw-lead',
    name: 'Saw Lead',
    category: 'leads',
    icon: '⚡',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.4 },
    },
  },
  {
    id: 'square-lead',
    name: 'Square Lead',
    category: 'leads',
    icon: '⬜',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 },
    },
  },
  {
    id: 'pulse-lead',
    name: 'Pulse Lead',
    category: 'leads',
    icon: '💫',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'pulse', width: 0.3 },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.5 },
    },
  },
  {
    id: 'detuned-saw',
    name: 'Detuned Saw',
    category: 'leads',
    icon: '🌊',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', spread: 30, count: 3 },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.6 },
    },
  },

  // ── Pads ────────────────────────────────────────────────────────────────────
  {
    id: 'warm-pad',
    name: 'Warm Pad',
    category: 'pads',
    icon: '☀️',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
      envelope: { attack: 0.8, decay: 1, sustain: 0.8, release: 2 },
    },
  },
  {
    id: 'string-pad',
    name: 'String Pad',
    category: 'pads',
    icon: '🎻',
    synthType: 'FMSynth',
    polyphonic: true,
    synthOptions: {
      harmonicity: 1,
      modulationIndex: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 1.0, decay: 0.5, sustain: 0.9, release: 2.5 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.8, decay: 0, sustain: 1, release: 2 },
    },
  },
  {
    id: 'glass-pad',
    name: 'Glass Pad',
    category: 'pads',
    icon: '💎',
    synthType: 'FMSynth',
    polyphonic: true,
    synthOptions: {
      harmonicity: 2,
      modulationIndex: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 0.8, sustain: 0.5, release: 2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 1.5 },
    },
  },
  {
    id: 'am-pad',
    name: 'AM Pad',
    category: 'pads',
    icon: '🌀',
    synthType: 'AMSynth',
    polyphonic: true,
    synthOptions: {
      harmonicity: 2.5,
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.0, decay: 0.5, sustain: 0.8, release: 3 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 2 },
    },
  },
  {
    id: 'choir-pad',
    name: 'Choir Pad',
    category: 'pads',
    icon: '🎤',
    synthType: 'Synth',
    polyphonic: true,
    synthOptions: {
      oscillator: { type: 'fatsine4', spread: 40, count: 5 },
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.9, release: 3 },
    },
  },

  // ── Bass ────────────────────────────────────────────────────────────────────
  {
    id: 'sub-bass',
    name: 'Sub Bass',
    category: 'bass',
    icon: '🔈',
    synthType: 'Synth',
    polyphonic: true,
    previewNote: 36,
    synthOptions: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 },
    },
  },
  {
    id: 'synth-bass',
    name: 'Synth Bass',
    category: 'bass',
    icon: '🔊',
    synthType: 'Synth',
    polyphonic: true,
    previewNote: 36,
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2 },
    },
  },
  {
    id: 'fm-bass',
    name: 'FM Bass',
    category: 'bass',
    icon: '📻',
    synthType: 'FMSynth',
    polyphonic: true,
    previewNote: 36,
    synthOptions: {
      harmonicity: 1,
      modulationIndex: 8,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.2 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
    },
  },
  {
    id: 'acid-bass',
    name: 'Acid Bass',
    category: 'bass',
    icon: '🧪',
    synthType: 'MonoSynth',
    polyphonic: false,
    previewNote: 36,
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass', rolloff: -24 },
      filterEnvelope: {
        attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.2,
        baseFrequency: 200, octaves: 3,
      },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0.4, release: 0.1 },
    },
  },
  {
    id: 'pluck-bass',
    name: 'Pluck Bass',
    category: 'bass',
    icon: '🎸',
    synthType: 'PluckSynth',
    polyphonic: false,
    previewNote: 36,
    synthOptions: {
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.98,
    },
  },

  // ── Plucked ─────────────────────────────────────────────────────────────────
  {
    id: 'guitar',
    name: 'Guitar',
    category: 'plucked',
    icon: '🎸',
    synthType: 'PluckSynth',
    polyphonic: false,
    synthOptions: {
      attackNoise: 1.5,
      dampening: 3500,
      resonance: 0.97,
    },
  },
  {
    id: 'harp',
    name: 'Harp',
    category: 'plucked',
    icon: '🪕',
    synthType: 'PluckSynth',
    polyphonic: false,
    synthOptions: {
      attackNoise: 0.5,
      dampening: 5000,
      resonance: 0.99,
    },
  },
  {
    id: 'bell-pluck',
    name: 'Bell Pluck',
    category: 'plucked',
    icon: '✨',
    synthType: 'PluckSynth',
    polyphonic: false,
    synthOptions: {
      attackNoise: 0.8,
      dampening: 6000,
      resonance: 0.995,
    },
  },
  {
    id: 'sitar',
    name: 'Sitar',
    category: 'plucked',
    icon: '🪈',
    synthType: 'PluckSynth',
    polyphonic: false,
    synthOptions: {
      attackNoise: 2,
      dampening: 2000,
      resonance: 0.96,
    },
  },

  // ── Bells ───────────────────────────────────────────────────────────────────
  {
    id: 'fm-bell',
    name: 'FM Bell',
    category: 'bells',
    icon: '🔔',
    synthType: 'FMSynth',
    polyphonic: true,
    previewNote: 72,
    synthOptions: {
      harmonicity: 5.1,
      modulationIndex: 12,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.5, sustain: 0, release: 1.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 1 },
    },
  },
  {
    id: 'music-box',
    name: 'Music Box',
    category: 'bells',
    icon: '🎵',
    synthType: 'FMSynth',
    polyphonic: true,
    previewNote: 72,
    synthOptions: {
      harmonicity: 8,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.8 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 },
    },
  },
  {
    id: 'vibraphone',
    name: 'Vibraphone',
    category: 'bells',
    icon: '🎶',
    synthType: 'AMSynth',
    polyphonic: true,
    previewNote: 72,
    synthOptions: {
      harmonicity: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 2, sustain: 0.05, release: 1.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
    },
  },
  {
    id: 'chime',
    name: 'Chime',
    category: 'bells',
    icon: '🎐',
    synthType: 'MetalSynth',
    polyphonic: false,
    previewNote: 72,
    synthOptions: {
      frequency: 400,
      envelope: { attack: 0.001, decay: 1.8, release: 0.5 },
      harmonicity: 8,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 2,
    },
  },

  // ── Drums ───────────────────────────────────────────────────────────────────
  {
    id: 'kick',
    name: 'Kick',
    category: 'drums',
    icon: '🥁',
    synthType: 'MembraneSynth',
    polyphonic: false,
    previewNote: 36,
    synthOptions: {
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
    },
  },
  {
    id: 'tom',
    name: 'Tom',
    category: 'drums',
    icon: '🪘',
    synthType: 'MembraneSynth',
    polyphonic: false,
    previewNote: 48,
    synthOptions: {
      pitchDecay: 0.08,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
    },
  },
  {
    id: 'hi-hat',
    name: 'Hi-Hat',
    category: 'drums',
    icon: '🔩',
    synthType: 'MetalSynth',
    polyphonic: false,
    previewNote: 72,
    synthOptions: {
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 40,
      resonance: 8000,
      octaves: 1.5,
    },
  },
  {
    id: 'snare',
    name: 'Snare',
    category: 'drums',
    icon: '🪇',
    synthType: 'NoiseSynth',
    polyphonic: false,
    previewNote: 60,
    synthOptions: {
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    },
  },
  {
    id: 'acoustic-kit',
    name: 'Acoustic Kit',
    category: 'drums',
    icon: '🥁',
    synthType: 'Sampler',
    polyphonic: true,
    previewNote: 36,
    synthOptions: {},
    baseUrl: '/samples/drums/acoustic/',
    sampleMap: {
      36: 'kick.wav',
      37: 'snare-rim.wav',
      38: 'snare.wav',
      39: 'clap.wav',
      42: 'hihat-closed.wav',
      45: 'tom-low.wav',
      46: 'hihat-open.wav',
      47: 'tom-mid.wav',
      49: 'crash.wav',
      50: 'tom-high.wav',
      51: 'ride.wav',
    },
  },

  // ── FX ──────────────────────────────────────────────────────────────────────
  {
    id: 'noise-burst',
    name: 'Noise Burst',
    category: 'fx',
    icon: '💥',
    synthType: 'NoiseSynth',
    polyphonic: false,
    synthOptions: {
      noise: { type: 'pink' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
    },
  },
  {
    id: 'fm-experiment',
    name: 'FM Experiment',
    category: 'fx',
    icon: '🧬',
    synthType: 'FMSynth',
    polyphonic: true,
    synthOptions: {
      harmonicity: 3.5,
      modulationIndex: 20,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1 },
      modulation: { type: 'sawtooth' },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.5, release: 1 },
    },
  },
  {
    id: 'duo-voice',
    name: 'Duo Voice',
    category: 'fx',
    icon: '👥',
    synthType: 'DuoSynth',
    polyphonic: false,
    synthOptions: {
      vibratoAmount: 0.5,
      vibratoRate: 5,
      harmonicity: 1.5,
      voice0: {
        volume: -10,
        portamento: 0,
        oscillator: { type: 'sine' },
        filterEnvelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.5 },
        envelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.5 },
      },
      voice1: {
        volume: -10,
        portamento: 0,
        oscillator: { type: 'triangle' },
        filterEnvelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.5 },
        envelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.5 },
      },
    },
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const PRESETS_BY_ID = new Map(PRESETS.map((p) => [p.id, p]))

export const PRESETS_BY_CATEGORY = PRESET_CATEGORIES.map((cat) => ({
  ...cat,
  presets: PRESETS.filter((p) => p.category === cat.id),
}))

export const DEFAULT_PRESET_ID = 'triangle-lead'

export function getPreset(id: string): InstrumentPreset {
  return PRESETS_BY_ID.get(id) ?? PRESETS_BY_ID.get(DEFAULT_PRESET_ID)!
}

// ─── Migration from old InstrumentSettings ────────────────────────────────────

const LEGACY_MAP: Record<string, string> = {
  'synth': 'triangle-lead',
  'am-synth': 'am-pad',
  'fm-synth': 'electric-piano',
  'membrane': 'kick',
  'metal': 'hi-hat',
  'sampler': 'triangle-lead',
}

export function migratePresetId(settings?: { presetId?: string; type?: string }): string {
  if (settings?.presetId && PRESETS_BY_ID.has(settings.presetId)) return settings.presetId
  if (settings?.type) return LEGACY_MAP[settings.type] ?? DEFAULT_PRESET_ID
  return DEFAULT_PRESET_ID
}
