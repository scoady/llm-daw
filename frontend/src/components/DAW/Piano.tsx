/**
 * Piano — Maximalist, realistic 88-key piano keyboard component.
 *
 * Features: 3D ivory/ebony keys, mouse/touch playable with velocity,
 * computer keyboard input, MIDI hardware display, chord detection LCD,
 * note/frequency LCD, velocity meter, octave navigation, sustain pedal,
 * glissando, particle effects, note history, range minimap, pedal LEDs.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
        style={{ background: '#161922', border: '1px solid rgba(45,51,72,0.3)' }}
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
      className="flex flex-col h-full select-none overflow-hidden relative"
      style={{
        background: 'linear-gradient(180deg, #0e0806 0%, #1a100c 15%, #130a08 50%, #0a0604 100%)',
      }}
      tabIndex={-1}
    >
      {/* ── Wood grain overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,200,150,0.1) 2px, rgba(255,200,150,0.1) 3px)`,
      }} />

      {/* ── Compact header bar — all controls in one 28px row ── */}
      <div
        className="flex items-center gap-2 px-3 h-[28px] shrink-0 relative z-10"
        style={{
          background: 'linear-gradient(180deg, #12100e 0%, #0c0a08 100%)',
          borderBottom: '1px solid rgba(80,60,40,0.3)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        {/* Brand */}
        <span className="text-[9px] font-sans font-bold tracking-[0.25em] whitespace-nowrap"
          style={{ color: '#c8a882', textShadow: '0 1px 0 rgba(0,0,0,0.8)' }}>LLM-DAW</span>
        <span className="text-[7px] font-lcd tracking-[0.2em]" style={{ color: '#5a4838' }}>GRAND</span>

        {/* Decorative screw */}
        <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{
          background: 'radial-gradient(circle at 35% 35%, #c8a882, #5a4030)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
        }} />

        <div className="w-px h-3.5 bg-[rgba(80,60,40,0.2)]" />

        {/* Note LCD (inline) */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-lcd text-text-muted/30 tracking-wider">NOTE</span>
          <span className="font-lcd text-[12px] min-w-[36px] text-center tabular-nums"
            style={{ color: '#a0f0a0', textShadow: '0 0 6px rgba(160,240,160,0.4)' }}>
            {lastNote !== null ? noteFull(lastNote) : '---'}
          </span>
        </div>

        {/* Freq LCD */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-lcd text-text-muted/30 tracking-wider">FREQ</span>
          <span className="font-lcd text-[10px] min-w-[52px] tabular-nums"
            style={{ color: '#00d4ff', textShadow: '0 0 6px rgba(0,212,255,0.3)' }}>
            {lastNote !== null ? `${noteFreq(lastNote).toFixed(1)}` : '---'}
          </span>
        </div>

        {/* Chord LCD */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-lcd text-text-muted/30 tracking-wider">CHORD</span>
          <span className="font-lcd text-[12px] font-bold min-w-[40px] text-center"
            style={{ color: '#ff6bd6', textShadow: '0 0 6px rgba(255,107,214,0.4)' }}>
            {chord ?? '---'}
          </span>
        </div>

        {/* Velocity mini-bar (8 segments inline) */}
        <div className="flex items-center gap-[1px] h-[12px]">
          {Array.from({ length: 10 }, (_, i) => {
            const on = (i / 10) * 127 < lastVelocity
            const hue = i < 7 ? 120 : i < 9 ? 50 : 0
            return <div key={i} className="w-[3px] rounded-[0.5px]" style={{
              height: `${50 + (i / 10) * 50}%`,
              background: on ? `hsl(${hue}, 90%, 50%)` : 'rgba(255,255,255,0.04)',
              boxShadow: on ? `0 0 3px hsla(${hue}, 90%, 50%, 0.3)` : 'none',
            }} />
          })}
        </div>

        <div className="flex-1" />

        {/* Pedal LEDs */}
        <PedalLED label="SUS" on={sustainOn} />
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full transition-all duration-75" style={{
            background: midiLed ? '#ff9f1c' : '#1a1d2a',
            boxShadow: midiLed ? '0 0 4px #ff9f1c' : 'none',
          }} />
          <span className="text-[7px] font-lcd text-text-muted/40 tracking-wider">MIDI</span>
        </div>

        {/* Note history dots */}
        <div className="flex items-center gap-[2px]">
          {history.slice(-6).map((h) => (
            <div key={`${h.midi}-${h.time}`} className="w-[3px] h-[3px] rounded-full"
              style={{ background: `hsl(${noteHue(h.midi)}, 70%, 55%)`, boxShadow: `0 0 3px hsl(${noteHue(h.midi)}, 70%, 55%)` }} />
          ))}
        </div>

        <div className="w-px h-3.5 bg-[rgba(80,60,40,0.2)]" />

        {/* Octave nav */}
        <button onClick={() => shiftOctave(-1)}
          className="w-[18px] h-[18px] rounded-sm text-[9px] font-mono flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg,#2a2520,#1a1510)', border: '1px solid rgba(80,60,40,0.3)', color: '#c8a882' }}>
          &lsaquo;
        </button>
        <span className="font-lcd text-[10px] text-[#c8a882] w-[24px] text-center tabular-nums">
          C{Math.floor(baseNote / 12) - 1}
        </span>
        <button onClick={() => shiftOctave(1)}
          className="w-[18px] h-[18px] rounded-sm text-[9px] font-mono flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg,#2a2520,#1a1510)', border: '1px solid rgba(80,60,40,0.3)', color: '#c8a882' }}>
          &rsaquo;
        </button>

        <RangeMinimap baseNote={baseNote} />

        {/* Sustain */}
        <button
          onMouseDown={() => setSustainOn(true)}
          onMouseUp={() => setSustainOn(false)}
          onMouseLeave={() => sustainOn && setSustainOn(false)}
          className="h-[18px] px-2 rounded-sm text-[7px] font-lcd tracking-wider"
          style={{
            background: sustainOn ? 'linear-gradient(180deg,#1a3a1a,#0a2a0a)' : 'linear-gradient(180deg,#2a2520,#1a1510)',
            border: `1px solid ${sustainOn ? 'rgba(57,255,20,0.3)' : 'rgba(80,60,40,0.3)'}`,
            color: sustainOn ? '#39ff14' : '#8a7060',
            boxShadow: sustainOn ? '0 0 6px rgba(57,255,20,0.2)' : 'none',
          }}
        >
          {sustainOn ? 'SUS ON' : 'SUS'}
        </button>

        {/* Screw */}
        <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{
          background: 'radial-gradient(circle at 35% 35%, #c8a882, #5a4030)',
        }} />
      </div>

      {/* ── Glow strip + felt — combined 4px ── */}
      <div className="h-[4px] shrink-0 relative z-10" style={{
        background: 'linear-gradient(180deg, #1a0a06 0%, #2a1510 60%, #0a0604 100%)',
        boxShadow: activeMidiNotes.length > 0
          ? `0 2px 16px rgba(108,99,255,0.15), 0 1px 6px hsla(${noteHue(activeMidiNotes[0])}, 80%, 50%, 0.2)`
          : 'none',
      }} />

      {/* ── Key bed — takes ALL remaining space ── */}
      <div className="flex-1 relative min-h-0 overflow-hidden" style={{
        background: 'linear-gradient(180deg, #0a0604 0%, #12100e 100%)',
      }}>
        {/* Particle effects */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {particles.map(p => (
            <div key={p.id} className="absolute w-[5px] h-[5px] rounded-full"
              style={{
                left: `${p.x}%`, bottom: '25%',
                background: p.color,
                boxShadow: `0 0 10px ${p.color}, 0 0 20px ${p.color}`,
                animation: 'piano-particle 0.9s ease-out forwards',
              }} />
          ))}
        </div>

        {/* Key container — edge to edge with minimal margin */}
        <div className="absolute inset-x-[3px] top-0 bottom-[2px]">
          {/* White keys */}
          {whites.map(k => {
            const active = activeSet.has(k.midi)
            const vel = velocityMap.current.get(k.midi) ?? 80
            const hue = noteHue(k.midi)
            const isOctaveC = k.midi % 12 === 0
            return (
              <div key={k.midi} data-midi={k.midi}
                onMouseDown={(e) => handleKeyDown(k.midi, e)}
                onMouseEnter={(e) => handleKeyEnter(k.midi, e)}
                className="absolute top-0 bottom-0 cursor-pointer transition-transform duration-75"
                style={{ left: `${k.left}%`, width: `${k.width}%`, padding: '0 0.5px' }}>
                <div className="w-full h-full rounded-b-[5px] relative overflow-hidden" style={{
                  background: active
                    ? 'linear-gradient(180deg, #e0d8c8 0%, #d8d0c0 30%, #e8e0d0 70%, #f0e8d8 100%)'
                    : 'linear-gradient(180deg, #faf8f2 0%, #f4f0e8 20%, #ede8dc 60%, #e4ddd0 85%, #d8d0c0 100%)',
                  border: '1px solid #b8b0a0', borderTop: 'none',
                  boxShadow: active
                    ? `inset 0 2px 6px rgba(0,0,0,0.12), 0 0 14px hsla(${hue},80%,50%,${vel/180}), 0 0 28px hsla(${hue},80%,50%,${vel/360})`
                    : 'inset 0 -2px 0 #c8c0b0, inset -1px 0 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.12)',
                  transform: active ? 'perspective(600px) rotateX(-0.8deg) translateY(2px)' : 'none',
                }}>
                  {/* Ivory texture */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 5px)',
                  }} />
                  {/* Active glow */}
                  {active && <div className="absolute bottom-0 left-0 right-0 h-2/5 pointer-events-none" style={{
                    background: `linear-gradient(0deg, hsla(${hue},85%,55%,${vel/160}) 0%, transparent 100%)`,
                  }} />}
                  {/* Octave label */}
                  {isOctaveC && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-lcd pointer-events-none"
                    style={{ color: active ? `hsl(${hue},70%,40%)` : '#a09888', opacity: active ? 0.9 : 0.45 }}>
                    C{Math.floor(k.midi / 12) - 1}
                  </span>}
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
              <div key={k.midi} data-midi={k.midi}
                onMouseDown={(e) => { e.stopPropagation(); handleKeyDown(k.midi, e) }}
                onMouseEnter={(e) => handleKeyEnter(k.midi, e)}
                className="absolute top-0 z-20 cursor-pointer transition-transform duration-75"
                style={{ left: `${k.left}%`, width: `${k.width}%`, height: '60%' }}>
                <div className="w-full h-full rounded-b-[3px] relative" style={{
                  background: active
                    ? 'linear-gradient(180deg, #1a1a1e 0%, #252528 30%, #1e1e22 100%)'
                    : 'linear-gradient(180deg, #2a2a30 0%, #1e1e24 25%, #141418 60%, #0c0c10 100%)',
                  boxShadow: active
                    ? `inset 0 -1px 0 #333338, 0 1px 2px rgba(0,0,0,0.3), 0 0 12px hsla(${hue},80%,50%,${vel/220}), 0 0 24px hsla(${hue},80%,50%,${vel/440})`
                    : 'inset 0 -2px 0 #35353a, inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 6px rgba(0,0,0,0.5), 0 1px 0 rgba(0,0,0,0.8)',
                  transform: active ? 'translateY(2px)' : 'none',
                }}>
                  {/* Sheen */}
                  <div className="absolute top-0 left-[15%] right-[15%] h-[40%] rounded-b-sm pointer-events-none" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
                  }} />
                  {/* Active glow */}
                  {active && <div className="absolute inset-0 rounded-b-[3px] pointer-events-none" style={{
                    background: `radial-gradient(ellipse at 50% 120%, hsla(${hue},85%,55%,${vel/260}) 0%, transparent 70%)`,
                  }} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Particle keyframes */}
      <style>{`
        @keyframes piano-particle {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(-90px) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
