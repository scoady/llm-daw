/**
 * Audio Engine — wraps Tone.js to provide DAW playback capabilities.
 *
 * Responsible for:
 * - Playing MIDI clips via configurable synth presets
 * - Playing audio clips (via Tone.js Players)
 * - Transport control (play, pause, stop, seek)
 * - BPM management
 * - Per-track volume, pan, mute/solo via Tone.Channel
 * - Dynamic instrument preset swapping
 */

import * as Tone from 'tone'
import type { Track, Clip } from '@/types'
import { getPreset, DEFAULT_PRESET_ID, type InstrumentPreset, type SynthType } from '@/data/instrumentPresets'

// ─── SynthAdapter — unified interface over all Tone.js synth types ──────────

interface SynthAdapter {
  triggerAttack(note: string, time: number, velocity: number): void
  triggerRelease(note: string, time: number): void
  triggerAttackRelease(note: string, duration: number | string, time: number, velocity: number): void
  releaseAll(): void
  connect(dest: Tone.InputNode): SynthAdapter
  dispose(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToneConstructor = any

function getToneConstructor(synthType: SynthType): ToneConstructor {
  const map: Record<SynthType, ToneConstructor> = {
    Synth: Tone.Synth,
    AMSynth: Tone.AMSynth,
    FMSynth: Tone.FMSynth,
    MonoSynth: Tone.MonoSynth,
    DuoSynth: Tone.DuoSynth,
    MembraneSynth: Tone.MembraneSynth,
    MetalSynth: Tone.MetalSynth,
    PluckSynth: Tone.PluckSynth,
    NoiseSynth: Tone.NoiseSynth,
    Sampler: Tone.Synth, // Not used directly — DrumKitAdapter handles Sampler type
  }
  return map[synthType]
}

class PolySynthAdapter implements SynthAdapter {
  private synth: Tone.PolySynth

  constructor(synthType: SynthType, options: Record<string, unknown>) {
    const Ctor = getToneConstructor(synthType)
    this.synth = new Tone.PolySynth(Ctor, options)
  }

  triggerAttack(note: string, time: number, velocity: number) {
    this.synth.triggerAttack(note, time, velocity)
  }
  triggerRelease(note: string, time: number) {
    this.synth.triggerRelease(note, time)
  }
  triggerAttackRelease(note: string, duration: number | string, time: number, velocity: number) {
    this.synth.triggerAttackRelease(note, duration, time, velocity)
  }
  releaseAll() {
    this.synth.releaseAll()
  }
  connect(dest: Tone.InputNode) {
    this.synth.connect(dest)
    return this
  }
  dispose() {
    this.synth.dispose()
  }
}

class MonoSynthAdapter implements SynthAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private synth: any
  private type: SynthType

  constructor(synthType: SynthType, options: Record<string, unknown>) {
    this.type = synthType
    const Ctor = getToneConstructor(synthType)
    this.synth = new Ctor(options)
  }

  triggerAttack(note: string, time: number, velocity: number) {
    if (this.type === 'NoiseSynth') {
      this.synth.triggerAttack(time)
    } else if (this.type === 'PluckSynth') {
      this.synth.triggerAttack(note, time)
    } else {
      this.synth.triggerAttack(note, time, velocity)
    }
  }

  triggerRelease(_note: string, time: number) {
    if (this.type === 'PluckSynth') return // no release
    if (this.type === 'NoiseSynth' || this.type === 'MembraneSynth' || this.type === 'MetalSynth') {
      this.synth.triggerRelease(time)
    } else {
      this.synth.triggerRelease(time)
    }
  }

  triggerAttackRelease(note: string, duration: number | string, time: number, velocity: number) {
    if (this.type === 'NoiseSynth') {
      this.synth.triggerAttackRelease(duration, time)
    } else if (this.type === 'PluckSynth') {
      this.synth.triggerAttack(note, time)
    } else if (this.type === 'MetalSynth') {
      this.synth.triggerAttackRelease(duration, time, velocity)
    } else {
      this.synth.triggerAttackRelease(note, duration, time, velocity)
    }
  }

  releaseAll() {
    // Mono synths don't have releaseAll, just release
    try { this.synth.triggerRelease?.() } catch { /* ignore */ }
  }

  connect(dest: Tone.InputNode) {
    this.synth.connect(dest)
    return this
  }

  dispose() {
    this.synth.dispose()
  }
}

/**
 * DrumKitAdapter — plays acoustic drum one-shots mapped to GM MIDI pitches.
 * Each drum hit is a Tone.Player loading a WAV sample from /public/samples/.
 */
class DrumKitAdapter implements SynthAdapter {
  private players = new Map<number, Tone.Player>()
  private output: Tone.Gain
  private ready = false
  private readyPromise: Promise<void>

  constructor(sampleMap: Record<number, string>, baseUrl: string) {
    this.output = new Tone.Gain(1)

    const loadPromises: Promise<void>[] = []
    for (const [midiStr, filename] of Object.entries(sampleMap)) {
      const midi = Number(midiStr)
      const url = `${baseUrl}${filename}`
      const player = new Tone.Player().connect(this.output)
      this.players.set(midi, player)
      loadPromises.push(
        player.load(url).then(() => { /* loaded */ })
      )
    }

    this.readyPromise = Promise.all(loadPromises).then(() => {
      this.ready = true
    })
  }

  private noteToMidi(note: string): number {
    return Tone.Frequency(note).toMidi()
  }

  triggerAttack(note: string, time: number, velocity: number) {
    if (!this.ready) return
    const midi = this.noteToMidi(note)
    const player = this.players.get(midi)
    if (player) {
      player.volume.value = Tone.gainToDb(velocity)
      player.start(time)
    }
  }

  triggerRelease(_note: string, _time: number) {
    // One-shots — no-op
  }

  triggerAttackRelease(note: string, _duration: number | string, time: number, velocity: number) {
    this.triggerAttack(note, time, velocity)
  }

  releaseAll() {
    for (const player of this.players.values()) {
      player.stop()
    }
  }

  connect(dest: Tone.InputNode) {
    this.output.connect(dest)
    return this
  }

  dispose() {
    for (const player of this.players.values()) {
      player.dispose()
    }
    this.players.clear()
    this.output.dispose()
  }

  whenReady(): Promise<void> {
    return this.readyPromise
  }
}

export function createSynthFromPreset(preset: InstrumentPreset): SynthAdapter {
  if (preset.synthType === 'Sampler' && preset.sampleMap) {
    return new DrumKitAdapter(preset.sampleMap, preset.baseUrl ?? '')
  }
  if (preset.polyphonic) {
    return new PolySynthAdapter(preset.synthType, preset.synthOptions)
  }
  return new MonoSynthAdapter(preset.synthType, preset.synthOptions)
}

// ─── Channel represents one track's audio graph ──────────────────────────────

interface EngineChannel {
  channel: Tone.Channel
  synth?: SynthAdapter
  presetId?: string
  player?: Tone.Player
  parts: Tone.Part[]
}

// ─── AudioEngine singleton ────────────────────────────────────────────────────

class AudioEngine {
  private channels = new Map<string, EngineChannel>()
  private masterGain: Tone.Gain
  private masterLimiter: Tone.Limiter
  private initialized = false

  constructor() {
    this.masterGain    = new Tone.Gain(0.9)
    this.masterLimiter = new Tone.Limiter(-1)
    this.masterGain.connect(this.masterLimiter)
    this.masterLimiter.toDestination()
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await Tone.start()
    this.initialized = true
  }

  // ── BPM ──────────────────────────────────────────────────────────────────
  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm
  }

  getBpm(): number {
    return Tone.getTransport().bpm.value
  }

  // ── Transport ─────────────────────────────────────────────────────────────
  async play(): Promise<void> {
    await this.init()
    Tone.getTransport().start()
  }

  pause(): void {
    Tone.getTransport().pause()
  }

  stop(): void {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
  }

  seek(beat: number): void {
    const bars = Math.floor(beat / 4)
    const remainder = beat % 4
    Tone.getTransport().position = `${bars}:${remainder}:0`
  }

  getCurrentBeat(): number {
    const pos = Tone.getTransport().position as string
    const parts = pos.split(':')
    const bars = parseFloat(parts[0] ?? '0')
    const beats = parseFloat(parts[1] ?? '0')
    const sixteenths = parseFloat(parts[2] ?? '0')
    return bars * 4 + beats + sixteenths / 4
  }

  isPlaying(): boolean {
    return Tone.getTransport().state === 'started'
  }

  // ── Track channels ────────────────────────────────────────────────────────
  ensureChannel(trackId: string, type: 'midi' | 'audio' | 'instrument', presetId?: string): EngineChannel {
    if (this.channels.has(trackId)) return this.channels.get(trackId)!

    const channel = new Tone.Channel().connect(this.masterGain)
    const resolvedPresetId = presetId ?? DEFAULT_PRESET_ID

    let synth: SynthAdapter | undefined
    if (type === 'midi' || type === 'instrument') {
      const preset = getPreset(resolvedPresetId)
      synth = createSynthFromPreset(preset).connect(channel)
    }

    const ch: EngineChannel = { channel, synth, presetId: resolvedPresetId, parts: [] }
    this.channels.set(trackId, ch)
    return ch
  }

  removeChannel(trackId: string): void {
    const ch = this.channels.get(trackId)
    if (!ch) return
    ch.parts.forEach((p) => { p.stop(); p.dispose() })
    ch.synth?.dispose()
    ch.player?.dispose()
    ch.channel.dispose()
    this.channels.delete(trackId)
  }

  // ── Instrument preset swapping ──────────────────────────────────────────
  setTrackInstrument(trackId: string, presetId: string, trackType: 'midi' | 'audio' | 'instrument'): void {
    const ch = this.ensureChannel(trackId, trackType, presetId)

    // Skip if already loaded
    if (ch.presetId === presetId) return

    // Dispose old synth
    if (ch.synth) {
      ch.synth.releaseAll()
      ch.synth.dispose()
    }

    // Create new synth from preset
    const preset = getPreset(presetId)
    ch.synth = createSynthFromPreset(preset).connect(ch.channel)
    ch.presetId = presetId
  }

  // ── Preview a preset (transport-independent) ─────────────────────────────
  async previewPreset(presetId: string): Promise<void> {
    await this.init()
    const preset = getPreset(presetId)
    const synth = createSynthFromPreset(preset).connect(this.masterGain)

    // Wait for drum buffers if this is a sampler preset
    if (synth instanceof DrumKitAdapter) {
      await synth.whenReady()
    }

    const now = Tone.now() + 0.05

    if (preset.synthType === 'Sampler' && preset.sampleMap) {
      // Drum kit preview: kick-hat-snare-hat pattern
      const pattern = [36, 42, 38, 42] // kick, closed hat, snare, closed hat
      const spacing = 0.15
      for (let i = 0; i < pattern.length; i++) {
        synth.triggerAttackRelease(
          Tone.Frequency(pattern[i], 'midi').toNote(),
          0.1, now + i * spacing, 0.7,
        )
      }
      setTimeout(() => synth.dispose(), 2000)
    } else if (['drums', 'fx'].includes(preset.category) || !preset.polyphonic) {
      const note = Tone.Frequency(preset.previewNote ?? 60, 'midi').toNote()
      synth.triggerAttackRelease(note, 0.3, now, 0.7)
      setTimeout(() => synth.dispose(), 1500)
    } else {
      // Play a major chord
      const root = preset.previewNote ?? 60
      const notes = [root, root + 4, root + 7]
      for (const p of notes) {
        synth.triggerAttackRelease(Tone.Frequency(p, 'midi').toNote(), 0.5, now, 0.6)
      }
      setTimeout(() => synth.dispose(), 1500)
    }
  }

  // ── Track params ──────────────────────────────────────────────────────────
  setTrackVolume(trackId: string, volume: number): void {
    const ch = this.channels.get(trackId)
    if (ch) ch.channel.volume.value = Tone.gainToDb(volume)
  }

  setTrackPan(trackId: string, pan: number): void {
    const ch = this.channels.get(trackId)
    if (ch) ch.channel.pan.value = pan
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const ch = this.channels.get(trackId)
    if (ch) ch.channel.mute = muted
  }

  // ── Schedule clips ────────────────────────────────────────────────────────
  scheduleTrack(track: Track): void {
    const presetId = track.instrument?.presetId ?? DEFAULT_PRESET_ID
    const ch = this.ensureChannel(track.id, track.type, presetId)

    // Ensure correct instrument is loaded
    if (ch.presetId !== presetId) {
      this.setTrackInstrument(track.id, presetId, track.type)
    }

    // Clear existing parts
    ch.parts.forEach((p) => { p.stop(); p.dispose() })
    ch.parts = []

    if (track.muted) return

    for (const clip of track.clips) {
      if (clip.notes && (track.type === 'midi' || track.type === 'instrument')) {
        const part = this.scheduleClipNotes(clip, ch)
        if (part) ch.parts.push(part)
      }
    }
  }

  private scheduleClipNotes(clip: Clip, ch: EngineChannel): Tone.Part | null {
    if (!clip.notes?.length || !ch.synth) return null

    const bpm = Tone.getTransport().bpm.value
    const secPerBeat = 60 / bpm

    const events = clip.notes.map((note) => {
      const startTimeInSec = (clip.startBeat + note.startBeat) * secPerBeat
      const durationInSec = Math.max(0.05, note.durationBeats * secPerBeat)

      return {
        time: startTimeInSec,
        note: Tone.Frequency(note.pitch, 'midi').toNote(),
        duration: durationInSec,
        velocity: note.velocity / 127,
      }
    })

    const synth = ch.synth
    const part = new Tone.Part((time, event) => {
      synth.triggerAttackRelease(
        event.note,
        event.duration,
        time,
        event.velocity
      )
    }, events)

    part.start(0)
    return part
  }

  scheduleTracks(tracks: Track[]): void {
    // Remove channels for deleted tracks
    for (const [id] of this.channels) {
      if (!tracks.find((t) => t.id === id)) {
        this.removeChannel(id)
      }
    }
    // Schedule all tracks
    tracks.forEach((t) => this.scheduleTrack(t))
  }

  // ── Live MIDI input (note-on / note-off) ────────────────────────────────
  async triggerAttack(trackId: string, pitch: number, velocity: number = 100): Promise<void> {
    await this.init()
    const ch = this.channels.get(trackId)
    if (ch?.synth) {
      ch.synth.triggerAttack(
        Tone.Frequency(pitch, 'midi').toNote(),
        Tone.now(),
        velocity / 127
      )
    }
  }

  triggerRelease(trackId: string, pitch: number): void {
    const ch = this.channels.get(trackId)
    if (ch?.synth) {
      ch.synth.triggerRelease(
        Tone.Frequency(pitch, 'midi').toNote(),
        Tone.now()
      )
    }
  }

  // ── Preview a note (for piano roll click) ─────────────────────────────────
  previewNote(pitch: number, trackId?: string): void {
    if (trackId) {
      const ch = this.channels.get(trackId)
      ch?.synth?.triggerAttackRelease(
        Tone.Frequency(pitch, 'midi').toNote(),
        0.2,
        Tone.now(),
        0.7
      )
    } else {
      const synth = new Tone.PolySynth(Tone.Synth).toDestination()
      synth.triggerAttackRelease(
        Tone.Frequency(pitch, 'midi').toNote(),
        '8n',
        Tone.now()
      )
      setTimeout(() => synth.dispose(), 1000)
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  dispose(): void {
    this.stop()
    for (const [id] of this.channels) this.removeChannel(id)
    this.masterGain.dispose()
    this.masterLimiter.dispose()
  }
}

// Singleton export
export const audioEngine = new AudioEngine()
