/**
 * Piano — Maximalist, realistic 88-key piano keyboard component.
 *
 * Features: 3D ivory/ebony keys, mouse/touch playable with velocity,
 * computer keyboard input, MIDI hardware display, chord detection LCD,
 * note/frequency LCD, velocity meter, octave navigation, sustain pedal,
 * glissando, particle effects, note history, range minimap, pedal LEDs.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import { midiInputService } from '@/services/midiInputService'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MIDI_START = 21
const MIDI_END = 108
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const BLACK_SET = new Set([1, 3, 6, 8, 10])
const VIS_OCTAVES = 3
const NOTES_VIS = VIS_OCTAVES * 12

// Computer keyboard mapping (semitone offsets from baseNote)
const KEY_LOWER: Record<string, number> = {
  z:0, s:1, x:2, d:3, c:4, v:5, g:6, b:7, h:8, n:9, j:10, m:11, ',':12,
}
const KEY_UPPER: Record<string, number> = {
  q:12, '2':13, w:14, '3':15, e:16, r:17, '5':18, t:19, '6':20, y:21, '7':22, u:23, i:24,
}
const ALL_KEYS = { ...KEY_LOWER, ...KEY_UPPER }

// Chord patterns [intervals, suffix]
const CHORDS: [number[], string][] = [
  [[0,4,7,11],'maj7'], [[0,3,7,10],'m7'], [[0,4,7,10],'7'],
  [[0,3,6,9],'dim7'], [[0,3,6,10],'m7b5'], [[0,4,8],'aug'],
  [[0,4,7],''], [[0,3,7],'m'], [[0,3,6],'dim'],
  [[0,5,7],'sus4'], [[0,2,7],'sus2'],
]

interface KeyLayout { midi: number; left: number; width: number }
interface Particle { id: number; x: number; color: string }

// ─── Utilities ─────────────────────────────────────────────────────────────────

const isBlack = (m: number) => BLACK_SET.has(m % 12)
const noteFull = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`
const noteFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const noteHue = (m: number) => (m * 17 + 200) % 360

function detectChord(notes: number[]): string | null {
  if (notes.length < 3) return null
  const pcs = [...new Set(notes.map(n => n % 12))].sort((a, b) => a - b)
  for (let root = 0; root < 12; root++) {
    const ivs = pcs.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b)
    for (const [pat, suf] of CHORDS) {
      if (pat.length <= ivs.length && pat.every(p => ivs.includes(p)))
        return `${NOTE_NAMES[root]}${suf}`
    }
  }
  return null
}

function computeKeys(start: number, end: number) {
  const whites: KeyLayout[] = []
  const blacks: KeyLayout[] = []
  let wi = 0
  // Count total white keys first
  let tw = 0
  for (let i = start; i <= end; i++) if (!isBlack(i)) tw++
  const ww = 100 / tw
  const bw = ww * 0.62
  for (let midi = start; midi <= end; midi++) {
    if (isBlack(midi)) {
      blacks.push({ midi, left: wi * ww - bw / 2, width: bw })
    } else {
      whites.push({ midi, left: wi * ww, width: ww })
      wi++
    }
  }
  return { whites, blacks, totalWhite: tw }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function LCD({ label, value, color = '#a0f0a0', wide = false }: {
  label: string; value: string; color?: string; wide?: boolean
}) {
  return (
    <div className={clsx('flex flex-col gap-0.5', wide ? 'min-w-[120px]' : 'min-w-[80px]')}>
      <span className="text-[8px] font-lcd tracking-[0.2em] text-text-muted/50 uppercase">{label}</span>
      <div
        className="px-2 py-1 rounded-sm font-lcd text-center truncate"
        style={{
          background: 'linear-gradient(180deg, #060d06 0%, #0a140a 100%)',
          border: '1px solid #1a2a1a',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 6px rgba(0,0,0,0.3)',
          color,
          fontSize: wide ? '16px' : '13px',
          textShadow: `0 0 8px ${color}66`,
          letterSpacing: '0.08em',
        }}
      >
        {value || '---'}
      </div>
    </div>
  )
}

function VelocityBar({ velocity }: { velocity: number }) {
  const pct = (velocity / 127) * 100
  const segs = 16
  return (
    <div className="flex flex-col gap-0.5 min-w-[70px]">
      <span className="text-[8px] font-lcd tracking-[0.2em] text-text-muted/50 uppercase">Velocity</span>
      <div
        className="flex items-end gap-[1px] h-[22px] px-1.5 py-1 rounded-sm"
        style={{
          background: 'linear-gradient(180deg, #060d06 0%, #0a140a 100%)',
          border: '1px solid #1a2a1a',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {Array.from({ length: segs }, (_, i) => {
          const on = (i / segs) * 100 < pct
          const hue = i < 10 ? 120 : i < 13 ? 50 : 0
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px] transition-all duration-75"
              style={{
                height: `${40 + (i / segs) * 60}%`,
                background: on ? `hsl(${hue}, 90%, 50%)` : 'rgba(255,255,255,0.04)',
                boxShadow: on ? `0 0 4px hsla(${hue}, 90%, 50%, 0.4)` : 'none',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function PedalLED({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-[6px] h-[6px] rounded-full transition-all duration-150"
        style={{
          background: on ? '#39ff14' : '#1a1d2a',
          boxShadow: on ? '0 0 6px #39ff14, 0 0 12px rgba(57,255,20,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
        }}
      />
      <span className="text-[8px] font-lcd tracking-[0.15em] text-text-muted/50 uppercase">{label}</span>
    </div>
  )
}

function RangeMinimap({ baseNote }: { baseNote: number }) {
  const total = MIDI_END - MIDI_START + 1
  const startPct = ((baseNote - MIDI_START) / total) * 100
  const widthPct = (NOTES_VIS / total) * 100
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-lcd tracking-[0.15em] text-text-muted/50 uppercase">Range</span>
      <div
        className="w-[80px] h-[8px] rounded-full relative overflow-hidden"
        style={{ background: '#0a0d14', border: '1px solid rgba(45,51,72,0.3)' }}
      >
        {/* Tiny key indicators */}
        {Array.from({ length: 88 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i / 88) * 100}%`,
              width: `${100 / 88}%`,
              background: isBlack(i + MIDI_START) ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
          style={{
            left: `${startPct}%`,
            width: `${widthPct}%`,
            background: 'rgba(108, 99, 255, 0.4)',
            boxShadow: '0 0 6px rgba(108, 99, 255, 0.3)',
            border: '1px solid rgba(108, 99, 255, 0.6)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Main Piano Component ──────────────────────────────────────────────────────

export function Piano() {
  const activeMidiNotes = useDAWStore((s) => s.activeMidiNotes)
  const tracks = useDAWStore((s) => s.tracks)
  const addNote = useDAWStore((s) => s.addActiveMidiNote)
  const removeNote = useDAWStore((s) => s.removeActiveMidiNote)

  const [baseNote, setBaseNote] = useState(48) // C3
  const [sustainOn, setSustainOn] = useState(false)
  const [midiLed, setMidiLed] = useState(false)
  const [lastVelocity, setLastVelocity] = useState(0)
  const [particles, setParticles] = useState<Particle[]>([])

  const velocityMap = useRef(new Map<number, number>())
  const sustainedNotes = useRef(new Set<number>())
  const mouseDown = useRef(false)
  const mouseNote = useRef<number | null>(null)
  const heldKeys = useRef(new Set<string>())
  const containerRef = useRef<HTMLDivElement>(null)
  const midiLedTimer = useRef<ReturnType<typeof setTimeout>>()

  // Note history (last 12 notes)
  const [history, setHistory] = useState<{ midi: number; time: number }[]>([])

  const endNote = Math.min(baseNote + NOTES_VIS - 1, MIDI_END)
  const { whites, blacks } = useMemo(() => computeKeys(baseNote, endNote), [baseNote, endNote])

  const activeSet = useMemo(() => new Set(activeMidiNotes), [activeMidiNotes])
  const chord = useMemo(() => detectChord(activeMidiNotes), [activeMidiNotes])
  const lastNote = activeMidiNotes.length > 0 ? activeMidiNotes[activeMidiNotes.length - 1] : null

  // ── Find target track ────────────────────────────────────────────────────
  const getTrack = useCallback(() => {
    const armed = tracks.find(t => t.armed)
    return armed ?? tracks.find(t => t.type === 'midi' || t.type === 'instrument') ?? null
  }, [tracks])

  // ── Trigger helpers ──────────────────────────────────────────────────────
  const noteOn = useCallback((midi: number, vel: number) => {
    const track = getTrack()
    if (!track) return
    audioEngine.ensureChannel(track.id, track.type, track.instrument?.presetId)
    audioEngine.triggerAttack(track.id, midi, vel)
    addNote(midi)
    velocityMap.current.set(midi, vel)
    setLastVelocity(vel)
    setHistory(prev => [...prev.slice(-11), { midi, time: Date.now() }])

    // MIDI LED flash
    setMidiLed(true)
    clearTimeout(midiLedTimer.current)
    midiLedTimer.current = setTimeout(() => setMidiLed(false), 120)

    // Particle effect
    const wkCount = whites.length
    if (wkCount > 0) {
      // Approximate key x position as percentage
      const approxX = ((midi - baseNote) / NOTES_VIS) * 100
      const hue = noteHue(midi)
      setParticles(prev => [...prev.slice(-20), {
        id: Date.now() + Math.random(),
        x: approxX,
        color: `hsl(${hue}, 85%, 65%)`,
      }])
    }
  }, [getTrack, addNote, whites, blacks, baseNote])

  const noteOff = useCallback((midi: number) => {
    if (sustainOn) {
      sustainedNotes.current.add(midi)
      return
    }
    const track = getTrack()
    if (track) audioEngine.triggerRelease(track.id, midi)
    removeNote(midi)
    velocityMap.current.delete(midi)
  }, [getTrack, removeNote, sustainOn])

  // ── Release sustained notes when pedal released ──────────────────────────
  useEffect(() => {
    if (!sustainOn && sustainedNotes.current.size > 0) {
      const track = getTrack()
      for (const midi of sustainedNotes.current) {
        if (track) audioEngine.triggerRelease(track.id, midi)
        removeNote(midi)
        velocityMap.current.delete(midi)
      }
      sustainedNotes.current.clear()
    }
  }, [sustainOn, getTrack, removeNote])

  // ── MIDI hardware velocity tracking ──────────────────────────────────────
  useEffect(() => {
    const unOn = midiInputService.onNoteOn(({ pitch, velocity }) => {
      velocityMap.current.set(pitch, velocity)
      setLastVelocity(velocity)
      setHistory(prev => [...prev.slice(-11), { midi: pitch, time: Date.now() }])
      setMidiLed(true)
      clearTimeout(midiLedTimer.current)
      midiLedTimer.current = setTimeout(() => setMidiLed(false), 120)
    })
    const unOff = midiInputService.onNoteOff(({ pitch }) => {
      velocityMap.current.delete(pitch)
    })
    return () => { unOn(); unOff() }
  }, [])

  // ── Clean up particles ────────────────────────────────────────────────────
  useEffect(() => {
    if (particles.length === 0) return
    const timer = setTimeout(() => {
      setParticles(prev => prev.filter(p => Date.now() - p.id < 900))
    }, 1000)
    return () => clearTimeout(timer)
  }, [particles])

  // ── Computer keyboard input ──────────────────────────────────────────────
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()

      // Sustain pedal on spacebar
      if (key === ' ') { e.preventDefault(); setSustainOn(true); return }

      // Octave navigation
      if (key === '[') { setBaseNote(n => Math.max(MIDI_START, n - 12)); return }
      if (key === ']') { setBaseNote(n => Math.min(MIDI_END - NOTES_VIS + 1, n + 12)); return }

      const offset = ALL_KEYS[key]
      if (offset === undefined || heldKeys.current.has(key)) return
      heldKeys.current.add(key)
      const midi = baseNote + offset
      if (midi >= MIDI_START && midi <= MIDI_END) noteOn(midi, 90)
    }
    const handleUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === ' ') { setSustainOn(false); return }
      const offset = ALL_KEYS[key]
      if (offset === undefined) return
      heldKeys.current.delete(key)
      const midi = baseNote + offset
      if (midi >= MIDI_START && midi <= MIDI_END) noteOff(midi)
    }

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp) }
  }, [baseNote, noteOn, noteOff])

  // ── Mouse handlers ───────────────────────────────────────────────────────
  const getVelFromY = (e: React.MouseEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const pct = 1 - (e.clientY - rect.top) / rect.height
    return Math.round(Math.max(20, Math.min(127, pct * 127)))
  }

  const handleKeyDown = (midi: number, e: React.MouseEvent) => {
    mouseDown.current = true
    mouseNote.current = midi
    const vel = getVelFromY(e, e.currentTarget as HTMLElement)
    noteOn(midi, vel)
  }

  const handleKeyEnter = (midi: number, e: React.MouseEvent) => {
    if (!mouseDown.current) return
    if (mouseNote.current !== null && mouseNote.current !== midi) {
      noteOff(mouseNote.current)
    }
    mouseNote.current = midi
    const vel = getVelFromY(e, e.currentTarget as HTMLElement)
    noteOn(midi, vel)
  }

  useEffect(() => {
    const up = () => {
      if (mouseNote.current !== null) {
        noteOff(mouseNote.current)
        mouseNote.current = null
      }
      mouseDown.current = false
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [noteOff])

  // ── Octave navigation ────────────────────────────────────────────────────
  const shiftOctave = (dir: number) => {
    setBaseNote(n => {
      const next = n + dir * 12
      return Math.max(MIDI_START, Math.min(MIDI_END - NOTES_VIS + 1, next))
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full select-none overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0e0806 0%, #1a100c 15%, #130a08 50%, #0a0604 100%)',
      }}
      tabIndex={-1}
    >
      {/* ── Wood grain overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,200,150,0.1) 2px, rgba(255,200,150,0.1) 3px)`,
      }} />

      {/* ── Top Control Panel ── */}
      <div
        className="flex items-end gap-3 px-4 py-2 shrink-0 relative z-10"
        style={{
          background: 'linear-gradient(180deg, #12100e 0%, #0c0a08 100%)',
          borderBottom: '1px solid rgba(80,60,40,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,200,150,0.03)',
        }}
      >
        {/* Brand plate */}
        <div className="flex flex-col mr-3">
          <span
            className="text-[10px] font-sans font-bold tracking-[0.3em] whitespace-nowrap"
            style={{
              color: '#c8a882',
              textShadow: '0 1px 0 rgba(0,0,0,0.8), 0 0 12px rgba(200,168,130,0.15)',
            }}
          >
            LLM-DAW
          </span>
          <span
            className="text-[7px] font-lcd tracking-[0.4em]"
            style={{ color: '#8a7060' }}
          >
            GRAND PIANO
          </span>
        </div>

        {/* Decorative screw */}
        <div className="w-[6px] h-[6px] rounded-full mr-2 shrink-0" style={{
          background: 'radial-gradient(circle at 35% 35%, #c8a882, #5a4030)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)',
        }} />

        <div className="flex-1" />

        {/* LCDs and meters */}
        <LCD label="Note" value={lastNote !== null ? noteFull(lastNote) : ''} wide />
        <LCD label="Freq" value={lastNote !== null ? `${noteFreq(lastNote).toFixed(1)}Hz` : ''} color="#00d4ff" />
        <LCD label="Chord" value={chord ?? ''} color="#ff6bd6" wide />
        <VelocityBar velocity={lastVelocity} />

        <div className="flex-1" />

        {/* Octave nav */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-lcd tracking-[0.2em] text-text-muted/50 uppercase">Octave</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftOctave(-1)}
              className="w-[22px] h-[22px] rounded-sm text-[10px] font-mono transition-colors"
              style={{
                background: 'linear-gradient(180deg, #2a2520 0%, #1a1510 100%)',
                border: '1px solid rgba(80,60,40,0.3)',
                color: '#c8a882',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,200,150,0.05)',
              }}
            >
              &lsaquo;
            </button>
            <span className="font-lcd text-[12px] text-[#c8a882] w-[30px] text-center tabular-nums">
              C{Math.floor(baseNote / 12) - 1}
            </span>
            <button
              onClick={() => shiftOctave(1)}
              className="w-[22px] h-[22px] rounded-sm text-[10px] font-mono transition-colors"
              style={{
                background: 'linear-gradient(180deg, #2a2520 0%, #1a1510 100%)',
                border: '1px solid rgba(80,60,40,0.3)',
                color: '#c8a882',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,200,150,0.05)',
              }}
            >
              &rsaquo;
            </button>
          </div>
        </div>

        <RangeMinimap baseNote={baseNote} />

        {/* Sustain toggle */}
        <div className="flex flex-col gap-0.5 items-center">
          <span className="text-[8px] font-lcd tracking-[0.2em] text-text-muted/50 uppercase">Sustain</span>
          <button
            onMouseDown={() => setSustainOn(true)}
            onMouseUp={() => setSustainOn(false)}
            onMouseLeave={() => sustainOn && setSustainOn(false)}
            className="w-[36px] h-[22px] rounded-sm text-[8px] font-lcd tracking-wider transition-all"
            style={{
              background: sustainOn
                ? 'linear-gradient(180deg, #1a3a1a 0%, #0a2a0a 100%)'
                : 'linear-gradient(180deg, #2a2520 0%, #1a1510 100%)',
              border: `1px solid ${sustainOn ? 'rgba(57,255,20,0.3)' : 'rgba(80,60,40,0.3)'}`,
              color: sustainOn ? '#39ff14' : '#8a7060',
              boxShadow: sustainOn ? '0 0 8px rgba(57,255,20,0.2), inset 0 0 4px rgba(57,255,20,0.1)' : 'none',
            }}
          >
            {sustainOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Decorative screw */}
        <div className="w-[6px] h-[6px] rounded-full ml-1 shrink-0" style={{
          background: 'radial-gradient(circle at 35% 35%, #c8a882, #5a4030)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* ── Glow Strip (reactive light bar behind keys) ── */}
      <div
        className="h-[3px] shrink-0 transition-all duration-150"
        style={{
          background: activeMidiNotes.length > 0
            ? `linear-gradient(90deg, transparent 10%, hsla(${noteHue(activeMidiNotes[0])}, 80%, 50%, 0.4) 30%, hsla(${noteHue(activeMidiNotes[activeMidiNotes.length-1])}, 80%, 50%, 0.4) 70%, transparent 90%)`
            : 'linear-gradient(90deg, transparent 20%, rgba(108,99,255,0.05) 50%, transparent 80%)',
          boxShadow: activeMidiNotes.length > 0
            ? '0 2px 12px rgba(108,99,255,0.2), 0 0 20px rgba(108,99,255,0.1)'
            : 'none',
        }}
      />

      {/* ── Felt strip ── */}
      <div className="h-[6px] shrink-0" style={{
        background: 'linear-gradient(180deg, #1a0a06 0%, #2a1510 40%, #1a0a06 100%)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
      }} />

      {/* ── Key bed ── */}
      <div className="flex-1 relative min-h-0 overflow-hidden" style={{
        background: 'linear-gradient(180deg, #0a0604 0%, #12100e 100%)',
      }}>
        {/* Particle effects overlay */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute w-[4px] h-[4px] rounded-full"
              style={{
                left: `${p.x}%`,
                bottom: '20%',
                background: p.color,
                boxShadow: `0 0 8px ${p.color}, 0 0 16px ${p.color}`,
                animation: 'piano-particle 0.9s ease-out forwards',
              }}
            />
          ))}
        </div>

        {/* Key container */}
        <div className="absolute inset-x-[6px] top-0 bottom-[4px]">
          {/* White keys */}
          {whites.map(k => {
            const active = activeSet.has(k.midi)
            const vel = velocityMap.current.get(k.midi) ?? 80
            const hue = noteHue(k.midi)
            const isOctaveC = k.midi % 12 === 0
            return (
              <div
                key={k.midi}
                data-midi={k.midi}
                onMouseDown={(e) => handleKeyDown(k.midi, e)}
                onMouseEnter={(e) => handleKeyEnter(k.midi, e)}
                className="absolute top-0 bottom-0 cursor-pointer transition-transform duration-75"
                style={{
                  left: `${k.left}%`,
                  width: `${k.width}%`,
                  padding: '0 0.5px',
                }}
              >
                <div
                  className="w-full h-full rounded-b-[4px] relative overflow-hidden"
                  style={{
                    background: active
                      ? `linear-gradient(180deg, #e0d8c8 0%, #d8d0c0 30%, #e8e0d0 70%, #f0e8d8 100%)`
                      : `linear-gradient(180deg, #faf8f2 0%, #f4f0e8 20%, #ede8dc 60%, #e4ddd0 85%, #d8d0c0 100%)`,
                    border: '1px solid #b8b0a0',
                    borderTop: 'none',
                    boxShadow: active
                      ? `inset 0 2px 6px rgba(0,0,0,0.12), 0 0 12px hsla(${hue}, 80%, 50%, ${vel/200}), 0 0 24px hsla(${hue}, 80%, 50%, ${vel/400})`
                      : 'inset 0 -2px 0 #c8c0b0, inset -1px 0 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.12)',
                    transform: active ? 'perspective(600px) rotateX(-0.8deg) translateY(1px)' : 'none',
                  }}
                >
                  {/* Subtle ivory texture */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 5px)',
                  }} />

                  {/* Active glow from bottom */}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{
                      background: `linear-gradient(0deg, hsla(${hue}, 85%, 55%, ${vel/180}) 0%, transparent 100%)`,
                    }} />
                  )}

                  {/* Octave label */}
                  {isOctaveC && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-lcd pointer-events-none"
                      style={{ color: active ? `hsl(${hue}, 70%, 40%)` : '#a09888', opacity: active ? 0.9 : 0.5 }}
                    >
                      C{Math.floor(k.midi / 12) - 1}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Black keys */}
          {blacks.map(k => {
            const active = activeSet.has(k.midi)
            const vel = velocityMap.current.get(k.midi) ?? 80
            const hue = noteHue(k.midi)
            return (
              <div
                key={k.midi}
                data-midi={k.midi}
                onMouseDown={(e) => { e.stopPropagation(); handleKeyDown(k.midi, e) }}
                onMouseEnter={(e) => handleKeyEnter(k.midi, e)}
                className="absolute top-0 z-20 cursor-pointer transition-transform duration-75"
                style={{
                  left: `${k.left}%`,
                  width: `${k.width}%`,
                  height: '62%',
                }}
              >
                <div
                  className="w-full h-full rounded-b-[3px] relative"
                  style={{
                    background: active
                      ? `linear-gradient(180deg, #1a1a1e 0%, #252528 30%, #1e1e22 100%)`
                      : `linear-gradient(180deg, #2a2a30 0%, #1e1e24 25%, #141418 60%, #0c0c10 100%)`,
                    boxShadow: active
                      ? `inset 0 -1px 0 #333338, 0 1px 2px rgba(0,0,0,0.3), 0 0 10px hsla(${hue}, 80%, 50%, ${vel/250}), 0 0 20px hsla(${hue}, 80%, 50%, ${vel/500})`
                      : 'inset 0 -2px 0 #35353a, inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 6px rgba(0,0,0,0.5), 0 1px 0 rgba(0,0,0,0.8)',
                    transform: active ? 'translateY(2px)' : 'none',
                  }}
                >
                  {/* Sheen highlight */}
                  <div className="absolute top-0 left-[15%] right-[15%] h-[40%] rounded-b-sm pointer-events-none" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
                  }} />

                  {/* Active glow */}
                  {active && (
                    <div className="absolute inset-0 rounded-b-[3px] pointer-events-none" style={{
                      background: `radial-gradient(ellipse at 50% 120%, hsla(${hue}, 85%, 55%, ${vel/300}) 0%, transparent 70%)`,
                    }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Bottom Status Strip ── */}
      <div
        className="flex items-center gap-4 px-4 h-[24px] shrink-0 relative z-10"
        style={{
          background: 'linear-gradient(180deg, #0c0a08 0%, #12100e 100%)',
          borderTop: '1px solid rgba(80,60,40,0.2)',
        }}
      >
        <PedalLED label="SUSTAIN" on={sustainOn} />
        <PedalLED label="SOFT" on={false} />
        <PedalLED label="SOST" on={false} />

        <div className="w-px h-3 bg-border-subtle/20" />

        {/* MIDI Activity */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-[6px] h-[6px] rounded-full transition-all duration-75"
            style={{
              background: midiLed ? '#ff9f1c' : '#1a1d2a',
              boxShadow: midiLed ? '0 0 6px #ff9f1c, 0 0 12px rgba(255,159,28,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
          <span className="text-[8px] font-lcd tracking-[0.15em] text-text-muted/50 uppercase">MIDI</span>
        </div>

        <div className="flex-1" />

        {/* Note history */}
        <div className="flex items-center gap-[3px]">
          <span className="text-[8px] font-lcd tracking-[0.15em] text-text-muted/30 mr-1">HIST</span>
          {history.slice(-8).map((h) => {
            const hue = noteHue(h.midi)
            const age = (Date.now() - h.time) / 5000
            return (
              <div
                key={`${h.midi}-${h.time}`}
                className="w-[4px] h-[4px] rounded-full"
                style={{
                  background: `hsla(${hue}, 70%, 55%, ${Math.max(0.15, 1 - age)})`,
                  boxShadow: age < 0.3 ? `0 0 4px hsla(${hue}, 70%, 55%, 0.4)` : 'none',
                }}
              />
            )
          })}
        </div>

        <div className="w-px h-3 bg-border-subtle/20" />

        {/* Active notes count */}
        <span className="text-[8px] font-lcd text-text-muted/40">
          <span className={activeMidiNotes.length > 0 ? 'text-accent/70' : 'text-text-muted/40'}>
            {activeMidiNotes.length}
          </span>
          {' '}notes
        </span>

        {/* Range display */}
        <span className="text-[8px] font-lcd text-text-muted/30">
          {noteFull(baseNote)} — {noteFull(endNote)}
        </span>

        {/* Keyboard shortcut hint */}
        <span className="text-[7px] font-lcd text-text-muted/20 tracking-wider">
          Z-M / Q-I &bull; [ ] OCT &bull; SPACE SUS
        </span>
      </div>

      {/* ── Particle animation keyframes (injected once) ── */}
      <style>{`
        @keyframes piano-particle {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(-70px) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
