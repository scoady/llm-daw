/**
 * Audio Engine — wraps Tone.js to provide DAW playback capabilities.
 *
 * Responsible for:
 * - Playing MIDI clips (via Tone.js Synths)
 * - Playing audio clips (via Tone.js Players)
 * - Transport control (play, pause, stop, seek)
 * - BPM management
 * - Per-track volume, pan, mute/solo via Tone.Channel
 */

import * as Tone from 'tone'
import type { Track, Clip } from '@/types'

// ─── Channel represents one track's audio graph ──────────────────────────────
interface EngineChannel {
  channel: Tone.Channel
  synth?: Tone.PolySynth
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
    Tone.getTransport().position = `${beat}:0:0`
  }

  getCurrentBeat(): number {
    const pos = Tone.getTransport().position as string
    const parts = pos.split(':')
    const bars = parseInt(parts[0] ?? '0')
    const beats = parseInt(parts[1] ?? '0')
    return bars * 4 + beats
  }

  isPlaying(): boolean {
    return Tone.getTransport().state === 'started'
  }

  // ── Track channels ────────────────────────────────────────────────────────
  ensureChannel(trackId: string, type: 'midi' | 'audio' | 'instrument'): EngineChannel {
    if (this.channels.has(trackId)) return this.channels.get(trackId)!

    const channel = new Tone.Channel().connect(this.masterGain)

    let synth: Tone.PolySynth | undefined
    if (type === 'midi' || type === 'instrument') {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
      }).connect(channel)
    }

    const ch: EngineChannel = { channel, synth, parts: [] }
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
    const ch = this.ensureChannel(track.id, track.type)

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

    const beatsPerBar = 4
    const events = clip.notes.map((note) => ({
      time: `${Math.floor((clip.startBeat + note.startBeat) / beatsPerBar)}:${(clip.startBeat + note.startBeat) % beatsPerBar}:0`,
      note: Tone.Frequency(note.pitch, 'midi').toNote(),
      duration: `${note.durationBeats}n`,
      velocity: note.velocity / 127,
    }))

    const part = new Tone.Part((time, event) => {
      ch.synth?.triggerAttackRelease(
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
    const synth = trackId
      ? this.channels.get(trackId)?.synth
      : new Tone.PolySynth(Tone.Synth).toDestination()

    synth?.triggerAttackRelease(
      Tone.Frequency(pitch, 'midi').toNote(),
      '8n',
      Tone.now()
    )
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
