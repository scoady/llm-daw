/**
 * Visualizer — Radial spectrum analyzer with large chord + note display.
 * Left side: 128-bin FFT arc (mirrored) with chord in center ring.
 * Right side: Big flashy note panel with animated tiles and chord badge.
 * CRT scan-line / vignette overlay for retro feel.
 */
import { useRef, useEffect } from 'react'
import { audioEngine } from '@/services/audioEngine'
import { midiInputService } from '@/services/midiInputService'
import { midiToNoteName } from '@/services/midiService'

// ─── Timing ──────────────────────────────────────────────────────────────────
const FRAME_INTERVAL = 1000 / 30 // ~30 fps
const NOTE_FADE_MS = 500
const PEAK_DECAY_MS = 500
const PARTICLE_LIFETIME_MS = 800
const MAX_PARTICLES = 80
const NOTE_APPEAR_MS = 180 // scale-in animation duration
const NOTE_PULSE_MS = 120  // velocity pulse duration

// ─── Geometry ────────────────────────────────────────────────────────────────
const BIN_COUNT = 64 // half — mirrored for 128 visual bars
const DC_SKIP = 9 // skip low DC bins
const ARC_DEG = 270 // degrees of the arc
const ARC_START = (90 + (360 - ARC_DEG) / 2) * (Math.PI / 180) // start angle (rad)
const ARC_END = ARC_START + ARC_DEG * (Math.PI / 180)

// Radius multipliers (of Math.min(spectrumWidth, h)/2)
const R_INNER = 0.18
const R_BAR_BASE = 0.22
const R_BAR_MAX = 0.48

// Layout split: spectrum takes left portion, notes panel takes right
const SPECTRUM_X_FRAC = 0.32  // center X of spectrum as fraction of canvas width
const PANEL_LEFT_FRAC = 0.58  // where the note panel starts
const PANEL_RIGHT_FRAC = 0.97 // where the note panel ends

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = [
  '#00d4ff', '#00a0ff', '#3b82f6', '#6c63ff', '#9b59ff',
  '#c850c0', '#d94fdf', '#ff6bd6', '#ff4fa0', '#ff6b6b',
  '#ff9f43', '#ffd93d', '#6bff6b', '#39ff14', '#00ffc8',
]

// Note-specific colors — each pitch class (C, C#, D, ...) gets a unique neon color
const NOTE_COLORS: Record<number, string> = {
  0: '#ff4fa0',  // C  — hot pink
  1: '#ff6b6b',  // C# — coral
  2: '#ff9f43',  // D  — orange
  3: '#ffd93d',  // D# — gold
  4: '#6bff6b',  // E  — green
  5: '#39ff14',  // F  — neon green
  6: '#00ffc8',  // F# — cyan-green
  7: '#00d4ff',  // G  — cyan
  8: '#3b82f6',  // G# — blue
  9: '#6c63ff',  // A  — purple
  10: '#9b59ff', // A# — violet
  11: '#c850c0', // B  — magenta
}

/** Deterministic color for a bin index — smooth gradient around the arc. */
function binToColor(i: number, total: number): string {
  const t = i / Math.max(1, total - 1) // 0..1
  const idx = t * (PALETTE.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, PALETTE.length - 1)
  const frac = idx - lo
  return lerpColor(PALETTE[lo], PALETTE[hi], frac)
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

// Pre-compute bar colors (left half — right half mirrors)
const BAR_COLORS: string[] = []
for (let i = 0; i < BIN_COUNT; i++) {
  BAR_COLORS.push(binToColor(i, BIN_COUNT))
}

// ─── Chord detection ─────────────────────────────────────────────────────────
const CHORD_PATTERNS: [number[], string][] = [
  [[0, 4, 7], 'maj'],
  [[0, 3, 7], 'min'],
  [[0, 4, 7, 11], 'maj7'],
  [[0, 3, 7, 10], 'min7'],
  [[0, 4, 7, 10], '7'],
  [[0, 3, 6], 'dim'],
  [[0, 4, 8], 'aug'],
  [[0, 5, 7], 'sus4'],
  [[0, 2, 7], 'sus2'],
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface RadialParticle {
  angle: number
  radius: number
  speed: number
  alpha: number
  color: string
  birth: number
  size: number
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  alpha: number,
  blur = 18,
) {
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Glow pass
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
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

/** Draw a tapered bar (trapezoid) radiating outward from center. */
function drawRadialBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  rInner: number,
  rOuter: number,
  angularWidth: number,
  color: string,
  alpha: number,
) {
  const halfW = angularWidth / 2
  // Taper: outer end is 60% width of inner end
  const halfWOuter = halfW * 0.6

  const cos1 = Math.cos(angle - halfW)
  const sin1 = Math.sin(angle - halfW)
  const cos2 = Math.cos(angle + halfW)
  const sin2 = Math.sin(angle + halfW)
  const cos3 = Math.cos(angle + halfWOuter)
  const sin3 = Math.sin(angle + halfWOuter)
  const cos4 = Math.cos(angle - halfWOuter)
  const sin4 = Math.sin(angle - halfWOuter)

  ctx.beginPath()
  ctx.moveTo(cx + rInner * cos1, cy + rInner * sin1)
  ctx.lineTo(cx + rInner * cos2, cy + rInner * sin2)
  ctx.lineTo(cx + rOuter * cos3, cy + rOuter * sin3)
  ctx.lineTo(cx + rOuter * cos4, cy + rOuter * sin4)
  ctx.closePath()

  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
}

/** Ease-out bounce for note appearance. */
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** Draw rounded rect. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const scanLineOffset = useRef(0)
  const timeRef = useRef(0)

  // Peak hold per bin (left half only — mirrored)
  const peaksRef = useRef<Float64Array>(new Float64Array(BIN_COUNT))
  const peakTimesRef = useRef<Float64Array>(new Float64Array(BIN_COUNT))

  // Smoothed levels for gentle animation
  const smoothRef = useRef<Float64Array>(new Float64Array(BIN_COUNT))

  // Radial particles
  const particlesRef = useRef<RadialParticle[]>([])

  // Note tracking
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map())
  const fadingNotesRef = useRef<FadingNote[]>([])

  // Idle rotation angle
  const idleAngleRef = useRef(0)

  // Last detected chord for display persistence
  const lastChordRef = useRef<string | null>(null)
  const lastChordTimeRef = useRef(0)

  // ── MIDI subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubOn = midiInputService.onNoteOn((evt) => {
      fadingNotesRef.current = fadingNotesRef.current.filter(f => f.pitch !== evt.pitch)
      const ci = evt.pitch % 12
      activeNotesRef.current.set(evt.pitch, {
        velocity: evt.velocity,
        color: NOTE_COLORS[ci] ?? PALETTE[evt.pitch % PALETTE.length],
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

  // ── ResizeObserver ─────────────────────────────────────────────────────────
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

  // ── Animation loop ─────────────────────────────────────────────────────────
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
      const binCount = fftData.length // typically 256
      const t = timeRef.current
      const now = performance.now()

      // ── Layout calculations ───────────────────────────────────────────
      const cx = w * SPECTRUM_X_FRAC
      const cy = h / 2
      const spectrumSize = Math.min(w * 0.55, h)
      const radius = spectrumSize / 2
      const rBase = radius * R_BAR_BASE
      const rMax = radius * R_BAR_MAX
      const rInner = radius * R_INNER
      const arcSpan = ARC_END - ARC_START
      const barAngle = arcSpan / BIN_COUNT // angular width per bar
      const smooth = smoothRef.current
      const peaks = peaksRef.current
      const peakTimes = peakTimesRef.current

      // Note panel bounds
      const panelX = w * PANEL_LEFT_FRAC
      const panelY = h * 0.06
      const panelW = w * (PANEL_RIGHT_FRAC - PANEL_LEFT_FRAC)
      const panelH = h * 0.88

      // ── Compute bin levels ────────────────────────────────────────────
      const usableBins = binCount - DC_SKIP
      const binsPerBar = Math.max(1, Math.floor(usableBins / BIN_COUNT))
      const levels = new Float32Array(BIN_COUNT)
      let totalEnergy = 0

      for (let i = 0; i < BIN_COUNT; i++) {
        let sum = 0
        const start = DC_SKIP + i * binsPerBar
        for (let b = 0; b < binsPerBar; b++) {
          const idx = start + b
          if (idx < binCount) {
            sum += Math.max(0, (fftData[idx] + 80) / 80)
          }
        }
        const raw = Math.min(1, (sum / binsPerBar) ** 0.5 * 2.0)
        // Smooth with exponential decay
        smooth[i] += (raw - smooth[i]) * 0.35
        levels[i] = smooth[i]
        totalEnergy += levels[i]

        // Peak hold
        if (levels[i] > peaks[i]) {
          peaks[i] = levels[i]
          peakTimes[i] = now
        }
      }

      totalEnergy = Math.min(1, (totalEnergy / BIN_COUNT) * 2.5)
      const isIdle = totalEnergy < 0.04

      // ── 1. Clear ──────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h)

      // ── 2. Radial frequency bars (mirrored) ──────────────────────────
      const midAngle = (ARC_START + ARC_END) / 2

      for (let i = 0; i < BIN_COUNT; i++) {
        const level = levels[i]
        const color = BAR_COLORS[i]
        const barLen = level * (rMax - rBase)
        const rOuter = rBase + barLen

        // Left side: from mid going counter-clockwise
        const angleL = midAngle - (i + 0.5) * barAngle
        // Right side: mirror
        const angleR = midAngle + (i + 0.5) * barAngle

        if (level > 0.03) {
          // Glow pass (wider, dimmer)
          drawRadialBar(ctx, cx, cy, angleL, rBase - 1, rOuter + 2, barAngle * 1.5, color, level * 0.15)
          drawRadialBar(ctx, cx, cy, angleR, rBase - 1, rOuter + 2, barAngle * 1.5, color, level * 0.15)

          // Solid pass
          drawRadialBar(ctx, cx, cy, angleL, rBase, rOuter, barAngle * 0.8, color, 0.3 + level * 0.65)
          drawRadialBar(ctx, cx, cy, angleR, rBase, rOuter, barAngle * 0.8, color, 0.3 + level * 0.65)

          // Hot tip glow for loud bars
          if (level > 0.4) {
            ctx.save()
            ctx.shadowColor = color
            ctx.shadowBlur = 10
            ctx.globalAlpha = level * 0.4
            ctx.beginPath()
            ctx.arc(cx, cy, rOuter, angleL - barAngle * 0.3, angleL + barAngle * 0.3)
            ctx.strokeStyle = color
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(cx, cy, rOuter, angleR - barAngle * 0.3, angleR + barAngle * 0.3)
            ctx.stroke()
            ctx.restore()
          }
        } else if (isIdle) {
          // Idle: dim bar outlines
          drawRadialBar(ctx, cx, cy, angleL, rBase, rBase + 2, barAngle * 0.6, color, 0.06)
          drawRadialBar(ctx, cx, cy, angleR, rBase, rBase + 2, barAngle * 0.6, color, 0.06)
        }
      }

      // ── 3. Peak hold indicators ───────────────────────────────────────
      for (let i = 0; i < BIN_COUNT; i++) {
        const elapsed = now - peakTimes[i]
        if (elapsed > PEAK_DECAY_MS) {
          peaks[i] *= 0.95 // slow decay after hold
          continue
        }
        const peakAlpha = Math.max(0, 1 - elapsed / PEAK_DECAY_MS)
        if (peaks[i] < 0.08) continue

        const peakR = rBase + peaks[i] * (rMax - rBase)
        const color = BAR_COLORS[i]
        const angleL = midAngle - (i + 0.5) * barAngle
        const angleR = midAngle + (i + 0.5) * barAngle

        ctx.globalAlpha = peakAlpha * 0.8
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, peakR, angleL - barAngle * 0.35, angleL + barAngle * 0.35)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx, cy, peakR, angleR - barAngle * 0.35, angleR + barAngle * 0.35)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // ── 4. Inner ring + chord display ─────────────────────────────────
      // Ring
      const ringAlpha = isIdle ? 0.08 + Math.sin(t * 0.5) * 0.03 : 0.12 + totalEnergy * 0.15
      ctx.beginPath()
      ctx.arc(cx, cy, rBase - 4, 0, Math.PI * 2)
      ctx.strokeStyle = isIdle
        ? `rgba(108, 99, 255, ${ringAlpha})`
        : `rgba(255, 255, 255, ${ringAlpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Inner glow ring
      ctx.beginPath()
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(108, 99, 255, ${ringAlpha * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Idle rotating gradient on inner ring
      if (isIdle) {
        idleAngleRef.current += 0.008
        const idleGrad = ctx.createConicGradient(idleAngleRef.current, cx, cy)
        idleGrad.addColorStop(0, 'rgba(108, 99, 255, 0.06)')
        idleGrad.addColorStop(0.25, 'rgba(0, 212, 255, 0.04)')
        idleGrad.addColorStop(0.5, 'rgba(108, 99, 255, 0.06)')
        idleGrad.addColorStop(0.75, 'rgba(200, 80, 192, 0.04)')
        idleGrad.addColorStop(1, 'rgba(108, 99, 255, 0.06)')

        ctx.beginPath()
        ctx.arc(cx, cy, rBase - 5, 0, Math.PI * 2)
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true)
        ctx.fillStyle = idleGrad
        ctx.fill()
      }

      // Chord text in center of ring — BIG
      const activePitches = [...activeNotesRef.current.keys()]
      const chord = detectChord(activePitches)

      // Prune expired fading notes
      fadingNotesRef.current = fadingNotesRef.current.filter(
        f => now - f.fadeStart < NOTE_FADE_MS
      )

      // Track chord for persistence (show last chord briefly after release)
      if (chord) {
        lastChordRef.current = chord
        lastChordTimeRef.current = now
      }

      const chordAge = now - lastChordTimeRef.current
      const showChord = chord || (lastChordRef.current && chordAge < 800)
      const chordAlpha = chord ? 0.95 : Math.max(0, 1 - chordAge / 800) * 0.6

      if (showChord && lastChordRef.current) {
        // Big chord in center ring
        const chordFontSize = Math.max(28, Math.min(48, radius * 0.32))
        drawGlowText(ctx, lastChordRef.current, cx, cy, chordFontSize, '#6c63ff', chordAlpha, 24)
      }

      // ── 5. NOTE DISPLAY PANEL (right side) ────────────────────────────
      // Panel background
      ctx.save()
      roundRect(ctx, panelX, panelY, panelW, panelH, 12)
      ctx.fillStyle = 'rgba(10, 10, 18, 0.55)'
      ctx.fill()

      // Panel border glow
      roundRect(ctx, panelX, panelY, panelW, panelH, 12)
      ctx.strokeStyle = 'rgba(108, 99, 255, 0.18)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Subtle inner shadow at top
      const panelTopGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + 40)
      panelTopGrad.addColorStop(0, 'rgba(108, 99, 255, 0.06)')
      panelTopGrad.addColorStop(1, 'transparent')
      roundRect(ctx, panelX, panelY, panelW, 40, 12)
      ctx.fillStyle = panelTopGrad
      ctx.fill()
      ctx.restore()

      // "NOTES" header label
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#c0c4d8'
      ctx.font = `bold ${Math.max(10, panelH * 0.04)}px "Space Grotesk", sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('NOTES', panelX + 16, panelY + 12)
      ctx.globalAlpha = 1

      // Chord badge at top-right of panel
      if (showChord && lastChordRef.current) {
        const badgeFontSize = Math.max(18, Math.min(36, panelH * 0.1))
        const badgeX = panelX + panelW - 20
        const badgeY = panelY + 14 + badgeFontSize * 0.4

        // Badge background pill
        ctx.save()
        const badgeText = lastChordRef.current
        ctx.font = `bold ${badgeFontSize}px "Share Tech Mono", monospace`
        const badgeMetrics = ctx.measureText(badgeText)
        const bw = badgeMetrics.width + 24
        const bh = badgeFontSize + 12

        roundRect(ctx, badgeX - bw, badgeY - bh / 2, bw, bh, bh / 2)
        ctx.fillStyle = 'rgba(108, 99, 255, 0.2)'
        ctx.fill()
        roundRect(ctx, badgeX - bw, badgeY - bh / 2, bw, bh, bh / 2)
        ctx.strokeStyle = `rgba(108, 99, 255, ${0.3 * chordAlpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Badge text
        ctx.globalAlpha = chordAlpha
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${badgeFontSize}px "Share Tech Mono", monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = '#6c63ff'
        ctx.shadowBlur = 14
        ctx.fillText(badgeText, badgeX - 12, badgeY)
        ctx.shadowBlur = 0
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // ── Note tiles ───────────────────────────────────────────────────
      const tileAreaY = panelY + panelH * 0.16
      const tileAreaH = panelH * 0.78
      const tileInnerW = panelW - 32
      const tileX0 = panelX + 16

      // Gather all notes to display: active + fading
      interface DisplayNote {
        pitch: number
        name: string
        color: string
        alpha: number
        scale: number
        velocity: number
        isActive: boolean
        pulsePhase: number // 0-1, for velocity pulse
      }

      const displayNotes: DisplayNote[] = []

      // Active notes
      for (const [pitch, note] of activeNotesRef.current.entries()) {
        const age = now - note.startTime
        const appearFrac = Math.min(1, age / NOTE_APPEAR_MS)
        const scale = easeOutBack(appearFrac)
        const pulseFrac = Math.min(1, age / NOTE_PULSE_MS)
        const pulsePhase = 1 - pulseFrac // 1→0
        displayNotes.push({
          pitch,
          name: midiToNoteName(pitch),
          color: note.color,
          alpha: 1,
          scale,
          velocity: note.velocity,
          isActive: true,
          pulsePhase,
        })
      }

      // Fading notes
      for (const f of fadingNotesRef.current) {
        const fadeAge = now - f.fadeStart
        const fadeFrac = fadeAge / NOTE_FADE_MS
        const alpha = Math.max(0, 1 - fadeFrac)
        const scale = 1 - fadeFrac * 0.4 // shrink to 60%
        displayNotes.push({
          pitch: f.pitch,
          name: midiToNoteName(f.pitch),
          color: f.color,
          alpha,
          scale,
          velocity: f.velocity,
          isActive: false,
          pulsePhase: 0,
        })
      }

      // Sort by pitch for consistent layout
      displayNotes.sort((a, b) => a.pitch - b.pitch)

      if (displayNotes.length > 0) {
        // Calculate tile size to fill available space
        const maxCols = Math.min(4, displayNotes.length)
        const rows = Math.ceil(displayNotes.length / maxCols)
        const cols = Math.min(maxCols, displayNotes.length)

        const tileGap = 8
        const tileW = Math.min(
          (tileInnerW - (cols - 1) * tileGap) / cols,
          tileAreaH * 0.4
        )
        const tileH = Math.min(
          (tileAreaH - (rows - 1) * tileGap) / rows,
          tileW * 1.1
        )
        const tileFontSize = Math.max(18, Math.min(42, tileH * 0.45))
        const octaveFontSize = Math.max(10, tileFontSize * 0.45)

        // Center the grid
        const gridW = cols * tileW + (cols - 1) * tileGap
        const gridH = rows * tileH + (rows - 1) * tileGap
        const gridX0 = tileX0 + (tileInnerW - gridW) / 2
        const gridY0 = tileAreaY + (tileAreaH - gridH) / 2

        for (let idx = 0; idx < displayNotes.length; idx++) {
          const dn = displayNotes[idx]
          const col = idx % cols
          const row = Math.floor(idx / cols)

          const tx = gridX0 + col * (tileW + tileGap)
          const ty = gridY0 + row * (tileH + tileGap)
          const tcx = tx + tileW / 2
          const tcy = ty + tileH / 2

          ctx.save()

          // Apply scale transform from center of tile
          ctx.translate(tcx, tcy)
          ctx.scale(dn.scale, dn.scale)
          ctx.translate(-tcx, -tcy)

          // Tile background
          ctx.globalAlpha = dn.alpha * 0.85
          roundRect(ctx, tx, ty, tileW, tileH, 8)

          // Glow fill behind tile
          const tileGrad = ctx.createRadialGradient(
            tcx, tcy, 0,
            tcx, tcy, tileW * 0.8,
          )
          tileGrad.addColorStop(0, dn.color + '30') // 19% opacity
          tileGrad.addColorStop(1, 'rgba(10, 10, 18, 0.8)')
          ctx.fillStyle = tileGrad
          ctx.fill()

          // Tile border
          roundRect(ctx, tx, ty, tileW, tileH, 8)
          ctx.strokeStyle = dn.color
          ctx.lineWidth = dn.isActive ? 2 : 1
          ctx.globalAlpha = dn.alpha * (dn.isActive ? 0.7 : 0.3)
          ctx.stroke()

          // Velocity pulse — bright flash on note-on
          if (dn.pulsePhase > 0) {
            roundRect(ctx, tx, ty, tileW, tileH, 8)
            ctx.fillStyle = dn.color
            ctx.globalAlpha = dn.pulsePhase * 0.25 * (dn.velocity / 127)
            ctx.fill()
          }

          // Note name (e.g., "C#")
          const noteParts = dn.name.match(/^([A-G]#?)(\d+)$/)
          const noteLetter = noteParts ? noteParts[1] : dn.name
          const noteOctave = noteParts ? noteParts[2] : ''

          // Glow
          ctx.save()
          ctx.shadowColor = dn.color
          ctx.shadowBlur = 16
          ctx.globalAlpha = dn.alpha * 0.5
          ctx.fillStyle = dn.color
          ctx.font = `bold ${tileFontSize}px "Share Tech Mono", monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(noteLetter, tcx, tcy - octaveFontSize * 0.3)
          ctx.restore()

          // Sharp note text
          ctx.globalAlpha = dn.alpha * 0.95
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${tileFontSize}px "Share Tech Mono", monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(noteLetter, tcx, tcy - octaveFontSize * 0.3)

          // Octave number below
          ctx.globalAlpha = dn.alpha * 0.5
          ctx.fillStyle = dn.color
          ctx.font = `${octaveFontSize}px "Share Tech Mono", monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(noteOctave, tcx, tcy + tileFontSize * 0.4)

          // Velocity bar at bottom of tile
          if (dn.isActive) {
            const barH = 3
            const barY = ty + tileH - 8
            const velFrac = dn.velocity / 127
            const barW2 = (tileW - 16) * velFrac
            ctx.globalAlpha = dn.alpha * 0.6
            roundRect(ctx, tx + 8, barY, tileW - 16, barH, 1.5)
            ctx.fillStyle = 'rgba(255,255,255,0.08)'
            ctx.fill()
            roundRect(ctx, tx + 8, barY, barW2, barH, 1.5)
            ctx.fillStyle = dn.color
            ctx.fill()
          }

          ctx.restore()
        }
      } else {
        // Empty state — subtle hint
        ctx.globalAlpha = 0.15
        ctx.fillStyle = '#c0c4d8'
        const hintSize = Math.max(12, panelH * 0.045)
        ctx.font = `${hintSize}px "Space Grotesk", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Play notes to see them here', panelX + panelW / 2, panelY + panelH / 2)
        ctx.globalAlpha = 1
      }

      // ── 6. Radial particles ───────────────────────────────────────────
      // Spawn particles from high-amplitude bar tips
      if (!isIdle) {
        for (let i = 0; i < BIN_COUNT; i++) {
          if (levels[i] > 0.55 && Math.random() < levels[i] * 0.3 && particlesRef.current.length < MAX_PARTICLES) {
            const barR = rBase + levels[i] * (rMax - rBase)
            const angleL = midAngle - (i + 0.5) * barAngle
            const angleR = midAngle + (i + 0.5) * barAngle
            const spawnAngle = Math.random() < 0.5 ? angleL : angleR
            particlesRef.current.push({
              angle: spawnAngle + (Math.random() - 0.5) * barAngle * 0.5,
              radius: barR,
              speed: 0.3 + Math.random() * 0.8,
              alpha: 0.6 + Math.random() * 0.4,
              color: BAR_COLORS[i],
              birth: now,
              size: 1 + Math.random() * 1.5,
            })
          }
        }
      }

      // Update and draw particles
      const aliveParticles: RadialParticle[] = []
      for (const p of particlesRef.current) {
        const age = now - p.birth
        if (age > PARTICLE_LIFETIME_MS) continue
        const lifeFrac = age / PARTICLE_LIFETIME_MS
        const fadeAlpha = p.alpha * (1 - lifeFrac)

        p.radius += p.speed * (1 + lifeFrac) // accelerate outward
        p.angle += (Math.random() - 0.5) * 0.005 // slight wander

        const px = cx + p.radius * Math.cos(p.angle)
        const py = cy + p.radius * Math.sin(p.angle)

        // Glow
        ctx.beginPath()
        ctx.arc(px, py, p.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = fadeAlpha * 0.12
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(px, py, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = fadeAlpha
        ctx.fill()

        aliveParticles.push(p)
      }
      particlesRef.current = aliveParticles
      ctx.globalAlpha = 1

      // ── 7. CRT overlay: scan-lines + vignette ────────────────────────
      scanLineOffset.current = (scanLineOffset.current + 0.3) % 4
      ctx.fillStyle = 'rgba(255, 255, 255, 0.012)'
      for (let y = scanLineOffset.current; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1)
      }

      const vigGrad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 0.9)
      vigGrad.addColorStop(0, 'transparent')
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
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
