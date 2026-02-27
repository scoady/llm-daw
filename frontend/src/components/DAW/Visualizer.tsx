/**
 * Visualizer — FFT frequency bars + floating particles behind the Mixer tab.
 * Each bar gets a random color and lights up when its frequency bin is active.
 * CRT scan-line/vignette overlay for retro feel.
 * Note infographic flashes on screen when MIDI notes are played.
 */
import { useRef, useEffect } from 'react'
import { audioEngine } from '@/services/audioEngine'
import { midiInputService } from '@/services/midiInputService'
import { midiToNoteName, isBlackKey } from '@/services/midiService'

const FRAME_INTERVAL = 1000 / 30 // ~30fps
const PARTICLE_COUNT = 50
const BAR_COUNT = 64
const NOTE_FADE_MS = 400

// ─── Keyboard constants ─────────────────────────────────────────────────────
const KB_OCTAVES = 2
const KB_WHITE_COUNT = 7 * KB_OCTAVES          // 14 white keys
const KB_DEFAULT_BASE = 48                       // C3
const KB_WIDTH_RATIO = 0.55                      // keyboard occupies 55% of canvas width
const KB_HEIGHT_RATIO = 0.16                     // 16% of canvas height
const KB_BLACK_WIDTH_RATIO = 0.6                 // black key is 60% width of white
const KB_BLACK_HEIGHT_RATIO = 0.62               // black key is 62% height of white
const KB_BOTTOM_PAD = 12                         // px from canvas bottom

// White key index within an octave for each chromatic note (–1 = black key)
const CHROMATIC_TO_WHITE: number[] = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6]
// Black key offset from the left edge of its preceding white key (fraction of white key width)
const BLACK_KEY_OFFSETS: Record<number, number> = { 1: 0.65, 3: 0.65, 6: 0.65, 8: 0.65, 10: 0.65 }

// ─── Pre-generate stable random colors for each bar ──────────────────────────

const PALETTE = [
  '#00d4ff', '#00a0ff', '#3b82f6', '#6c63ff', '#9b59ff',
  '#c850c0', '#d94fdf', '#ff6bd6', '#ff4fa0', '#ff6b6b',
  '#ff9f43', '#ffd93d', '#6bff6b', '#39ff14', '#00ffc8',
]

function generateBarColors(): string[] {
  const colors: string[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    colors.push(PALETTE[Math.floor(Math.random() * PALETTE.length)])
  }
  return colors
}

function randomPaletteColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ─── Chord detection ─────────────────────────────────────────────────────────

const CHORD_PATTERNS: [number[], string][] = [
  [[0, 4, 7],     'maj'],
  [[0, 3, 7],     'min'],
  [[0, 4, 7, 11], 'maj7'],
  [[0, 3, 7, 10], 'min7'],
  [[0, 4, 7, 10], '7'],
  [[0, 3, 6],     'dim'],
  [[0, 4, 8],     'aug'],
  [[0, 5, 7],     'sus4'],
  [[0, 2, 7],     'sus2'],
  [[0, 4, 7, 14], 'add9'],
]

function detectChord(pitches: number[]): string | null {
  if (pitches.length < 3) return null
  const sorted = [...pitches].sort((a, b) => a - b)
  const root = sorted[0]
  const intervals = sorted.map(p => (p - root) % 12).sort((a, b) => a - b)
  const unique = [...new Set(intervals)]

  for (const [pattern, suffix] of CHORD_PATTERNS) {
    if (unique.length === pattern.length && unique.every((v, i) => v === pattern[i])) {
      const rootName = midiToNoteName(root).replace(/\d+$/, '')
      return `${rootName}${suffix}`
    }
  }
  return null
}

// ─── Note tracking types ─────────────────────────────────────────────────────

interface ActiveNote {
  velocity: number
  color: string
  startTime: number
}

interface FadingNote {
  pitch: number
  velocity: number
  color: string
  fadeStart: number
}

// ─── Particle ─────────────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  color: string
}

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(Math.random() * 0.4 + 0.1),
    radius: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  }
}

// ─── Draw note infographic ───────────────────────────────────────────────────

function drawNoteOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
  activeNotes: Map<number, ActiveNote>,
  fadingNotes: FadingNote[],
) {
  // Collect all notes to display with their alpha
  const displayNotes: { pitch: number; velocity: number; color: string; alpha: number }[] = []

  for (const [pitch, note] of activeNotes) {
    // Quick ramp-in over 50ms
    const age = now - note.startTime
    const rampAlpha = Math.min(1, age / 50)
    displayNotes.push({ pitch, velocity: note.velocity, color: note.color, alpha: rampAlpha })
  }

  for (const fn of fadingNotes) {
    const elapsed = now - fn.fadeStart
    const alpha = Math.max(0, 1 - elapsed / NOTE_FADE_MS)
    if (alpha > 0) {
      displayNotes.push({ pitch: fn.pitch, velocity: fn.velocity, color: fn.color, alpha })
    }
  }

  if (displayNotes.length === 0) return

  // Position: center-right area
  const cx = w * 0.72
  let cy = h * 0.3

  // Chord detection
  const activePitches = displayNotes.filter(n => n.alpha > 0.5).map(n => n.pitch)
  const chord = detectChord(activePitches)

  if (chord) {
    const maxAlpha = Math.max(...displayNotes.map(n => n.alpha))
    const chordColor = displayNotes[0].color
    drawGlowText(ctx, chord, cx, cy - 10, 28, chordColor, maxAlpha * 0.7)
    cy += 20
  }

  // Draw each note
  for (let i = 0; i < displayNotes.length; i++) {
    const { pitch, velocity, color, alpha } = displayNotes[i]
    const noteName = midiToNoteName(pitch)
    const freq = midiToFrequency(pitch).toFixed(1)
    const black = isBlackKey(pitch)
    const y = cy + i * 60

    if (y > h - 30) break // don't overflow canvas

    // Note name — big glowing text
    const fontSize = 36
    drawGlowText(ctx, noteName, cx, y, fontSize, color, alpha)

    // Sharp/flat indicator styling — slightly different treatment for black keys
    if (black) {
      ctx.globalAlpha = alpha * 0.4
      ctx.fillStyle = color
      ctx.font = '11px "Share Tech Mono", monospace'
      ctx.fillText('♯', cx + ctx.measureText(noteName).width / 2 + 22, y - 8)
    }

    // Frequency readout — smaller, dimmer
    ctx.globalAlpha = alpha * 0.45
    ctx.fillStyle = color
    ctx.font = '13px "Share Tech Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${freq} Hz`, cx, y + 18)

    // Velocity bar
    const velNorm = velocity / 127
    const barW = 60
    const barH = 3
    const barX = cx - barW / 2
    const barY = y + 26

    // Bar background
    ctx.globalAlpha = alpha * 0.15
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(barX, barY, barW, barH)

    // Bar fill — brightness scales with velocity
    ctx.globalAlpha = alpha * (0.4 + velNorm * 0.5)
    ctx.fillStyle = color
    ctx.fillRect(barX, barY, barW * velNorm, barH)

    ctx.globalAlpha = 1
  }

  ctx.globalAlpha = 1
  ctx.textAlign = 'start'
}

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  alpha: number,
) {
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Shadow/glow pass
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.globalAlpha = alpha * 0.6
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()

  // Sharp pass
  ctx.globalAlpha = alpha * 0.95
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)

  ctx.globalAlpha = 1
}

// ─── Draw mini keyboard ──────────────────────────────────────────────────────

function computeKeyboardBase(
  activeNotes: Map<number, ActiveNote>,
  fadingNotes: FadingNote[],
  lastBase: number,
): number {
  // Collect all visible pitches
  const pitches: number[] = []
  for (const [p] of activeNotes) pitches.push(p)
  for (const f of fadingNotes) pitches.push(f.pitch)
  if (pitches.length === 0) return lastBase

  // Find the lowest pitch and snap to octave start (C)
  const lowest = Math.min(...pitches)
  const octave = Math.floor(lowest / 12)
  const base = octave * 12
  // Clamp to reasonable MIDI range
  return Math.max(24, Math.min(96, base))
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
  activeNotes: Map<number, ActiveNote>,
  fadingNotes: FadingNote[],
  base: number,
) {
  const totalW = w * KB_WIDTH_RATIO
  const totalH = h * KB_HEIGHT_RATIO
  const startX = (w - totalW) / 2
  const startY = h - totalH - KB_BOTTOM_PAD
  const whiteW = totalW / KB_WHITE_COUNT
  const whiteH = totalH
  const blackW = whiteW * KB_BLACK_WIDTH_RATIO
  const blackH = whiteH * KB_BLACK_HEIGHT_RATIO
  const radius = 3

  // Build a map of pitch → { color, alpha } for all visible notes
  const noteState = new Map<number, { color: string; alpha: number; velocity: number }>()
  for (const [pitch, note] of activeNotes) {
    const age = now - note.startTime
    const alpha = Math.min(1, age / 50)
    noteState.set(pitch, { color: note.color, alpha, velocity: note.velocity })
  }
  for (const fn of fadingNotes) {
    const elapsed = now - fn.fadeStart
    const alpha = Math.max(0, 1 - elapsed / NOTE_FADE_MS)
    if (alpha > 0 && !noteState.has(fn.pitch)) {
      noteState.set(fn.pitch, { color: fn.color, alpha, velocity: fn.velocity })
    }
  }

  // ── Draw white keys ────────────────────────────────────────────────
  let whiteIdx = 0
  for (let oct = 0; oct < KB_OCTAVES; oct++) {
    for (let note = 0; note < 12; note++) {
      const wi = CHROMATIC_TO_WHITE[note]
      if (wi === -1) continue // skip black keys

      const midi = base + oct * 12 + note
      const kx = startX + whiteIdx * whiteW
      const state = noteState.get(midi)

      // Key body
      ctx.beginPath()
      ctx.roundRect(kx + 1, startY, whiteW - 2, whiteH, [0, 0, radius, radius])

      if (state) {
        // Active/fading — glow fill
        const velBright = 0.4 + (state.velocity / 127) * 0.6
        ctx.save()
        ctx.shadowColor = state.color
        ctx.shadowBlur = 14
        ctx.globalAlpha = state.alpha * velBright * 0.5
        ctx.fillStyle = state.color
        ctx.fill()
        ctx.restore()

        // Solid color fill
        ctx.globalAlpha = state.alpha * velBright * 0.7
        ctx.fillStyle = state.color
        ctx.fill()

        // Note label
        ctx.globalAlpha = state.alpha * 0.9
        ctx.fillStyle = '#ffffff'
        ctx.font = '10px "Share Tech Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(midiToNoteName(midi), kx + whiteW / 2, startY + whiteH - 4)
      } else {
        // Inactive white key — dark translucent
        ctx.globalAlpha = 0.12
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }

      // Border
      ctx.globalAlpha = 0.15
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(kx + 1, startY, whiteW - 2, whiteH, [0, 0, radius, radius])
      ctx.stroke()

      ctx.globalAlpha = 1
      whiteIdx++
    }
  }

  // ── Draw black keys (on top) ───────────────────────────────────────
  whiteIdx = 0
  for (let oct = 0; oct < KB_OCTAVES; oct++) {
    for (let note = 0; note < 12; note++) {
      const wi = CHROMATIC_TO_WHITE[note]
      if (wi === -1) continue

      // Check if next chromatic note is a black key
      const blackNote = note + 1
      if (blackNote < 12 && BLACK_KEY_OFFSETS[blackNote] !== undefined) {
        const midi = base + oct * 12 + blackNote
        const kx = startX + whiteIdx * whiteW + whiteW * BLACK_KEY_OFFSETS[blackNote] - blackW / 2
        const state = noteState.get(midi)

        ctx.beginPath()
        ctx.roundRect(kx, startY, blackW, blackH, [0, 0, radius, radius])

        if (state) {
          const velBright = 0.4 + (state.velocity / 127) * 0.6

          // Glow
          ctx.save()
          ctx.shadowColor = state.color
          ctx.shadowBlur = 12
          ctx.globalAlpha = state.alpha * velBright * 0.6
          ctx.fillStyle = state.color
          ctx.fill()
          ctx.restore()

          // Solid fill
          ctx.globalAlpha = state.alpha * velBright * 0.8
          ctx.fillStyle = state.color
          ctx.fill()
        } else {
          // Inactive black key — darker
          ctx.globalAlpha = 0.25
          ctx.fillStyle = '#0a0a0f'
          ctx.fill()

          // Subtle highlight edge
          ctx.globalAlpha = 0.08
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        ctx.globalAlpha = 1
      }

      whiteIdx++
    }
  }

  ctx.globalAlpha = 1
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

// ─── Visualizer Component ─────────────────────────────────────────────────────

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const particlesRef = useRef<Particle[]>([])
  const barColorsRef = useRef<string[]>(generateBarColors())
  const scanLineOffset = useRef(0)
  const timeRef = useRef(0)

  // Note tracking refs (no re-renders)
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map())
  const fadingNotesRef = useRef<FadingNote[]>([])
  const kbBaseRef = useRef(KB_DEFAULT_BASE)

  // Subscribe to MIDI note on/off events
  useEffect(() => {
    const unsubOn = midiInputService.onNoteOn((evt) => {
      // Remove from fading if re-struck
      fadingNotesRef.current = fadingNotesRef.current.filter(f => f.pitch !== evt.pitch)
      activeNotesRef.current.set(evt.pitch, {
        velocity: evt.velocity,
        color: randomPaletteColor(),
        startTime: performance.now(),
      })
    })

    const unsubOff = midiInputService.onNoteOff((evt) => {
      const note = activeNotesRef.current.get(evt.pitch)
      if (note) {
        fadingNotesRef.current.push({
          pitch: evt.pitch,
          velocity: note.velocity,
          color: note.color,
          fadeStart: performance.now(),
        })
        activeNotesRef.current.delete(evt.pitch)
      }
    })

    return () => { unsubOn(); unsubOff() }
  }, [])

  // Responsive canvas sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      sizeRef.current = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = sizeRef.current.w
        canvas.height = sizeRef.current.h
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    let lastFrame = 0

    const draw = (timestamp: number) => {
      animRef.current = requestAnimationFrame(draw)

      if (timestamp - lastFrame < FRAME_INTERVAL) return
      lastFrame = timestamp
      timeRef.current += 0.02

      const canvas = canvasRef.current
      if (!canvas) return
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) return

      const ctx = canvas.getContext('2d')!
      const fftData = audioEngine.getFrequencyData()
      const binCount = fftData.length
      const t = timeRef.current

      // Total energy for particles
      let totalEnergy = 0
      for (let i = 0; i < binCount; i++) {
        totalEnergy += Math.max(0, (fftData[i] + 80) / 80)
      }
      totalEnergy = Math.min(1, (totalEnergy / binCount) ** 0.6 * 2.5)

      // ── Clear ─────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h)

      // ── Frequency bars ────────────────────────────────────────────────
      const barColors = barColorsRef.current
      const gap = 2
      const barWidth = Math.max(2, (w - gap * BAR_COUNT) / BAR_COUNT)
      const binsPerBar = Math.floor(binCount / BAR_COUNT)

      for (let i = 0; i < BAR_COUNT; i++) {
        // Average the FFT bins for this bar
        let sum = 0
        const startBin = i * binsPerBar
        for (let b = 0; b < binsPerBar; b++) {
          sum += Math.max(0, (fftData[startBin + b] + 80) / 80)
        }
        const level = Math.min(1, (sum / binsPerBar) ** 0.5 * 2.0)

        if (level < 0.05) continue // skip silent bars

        const barH = level * h * 0.85
        const x = i * (barWidth + gap)
        const color = barColors[i]

        // Glow pass (wider, transparent)
        ctx.fillStyle = color
        ctx.globalAlpha = level * 0.2
        ctx.beginPath()
        ctx.roundRect(x - 2, h - barH - 2, barWidth + 4, barH + 2, 3)
        ctx.fill()

        // Solid bar
        ctx.globalAlpha = 0.3 + level * 0.6
        ctx.beginPath()
        ctx.roundRect(x, h - barH, barWidth, barH, [2, 2, 0, 0])
        ctx.fill()

        // Hot tip glow
        if (level > 0.3) {
          ctx.globalAlpha = level * 0.5
          ctx.shadowColor = color
          ctx.shadowBlur = 8
          ctx.fillRect(x, h - barH, barWidth, 2)
          ctx.shadowBlur = 0
        }

        ctx.globalAlpha = 1
      }

      // ── Draw particles ────────────────────────────────────────────────
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particlesRef.current.push(createParticle(w, h))
        }
      }

      for (const p of particlesRef.current) {
        const speedMult = 0.3 + totalEnergy * 3.0
        p.x += p.vx + Math.sin(t + p.y * 0.01) * 0.2
        p.y += p.vy * speedMult

        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10

        const brightAlpha = p.alpha * (0.2 + totalEnergy * 1.5)

        // Glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = brightAlpha * 0.15
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = brightAlpha
        ctx.fill()

        ctx.globalAlpha = 1
      }

      // ── Note infographic overlay ────────────────────────────────────
      const now = performance.now()

      // Prune expired fading notes
      fadingNotesRef.current = fadingNotesRef.current.filter(
        f => now - f.fadeStart < NOTE_FADE_MS
      )

      drawNoteOverlay(ctx, w, h, now, activeNotesRef.current, fadingNotesRef.current)

      // ── Mini keyboard ───────────────────────────────────────────────
      kbBaseRef.current = computeKeyboardBase(
        activeNotesRef.current, fadingNotesRef.current, kbBaseRef.current,
      )
      drawKeyboard(ctx, w, h, now, activeNotesRef.current, fadingNotesRef.current, kbBaseRef.current)

      // ── CRT overlay: scan-lines + vignette ────────────────────────────
      scanLineOffset.current = (scanLineOffset.current + 0.3) % 4
      ctx.fillStyle = 'rgba(255, 255, 255, 0.012)'
      for (let y = scanLineOffset.current; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1)
      }

      const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7)
      vigGrad.addColorStop(0, 'transparent')
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)')
      ctx.fillStyle = vigGrad
      ctx.fillRect(0, 0, w, h)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
