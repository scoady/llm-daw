/**
 * Visualizer — Radial spectrum analyzer behind the Mixer tab.
 * 128 FFT bins mapped to a 270° arc with mirrored symmetry.
 * Inner ring displays detected chord / active notes.
 * Radial particles burst outward from high-amplitude bars.
 * CRT scan-line / vignette overlay for retro feel.
 */
import { useRef, useEffect } from 'react'
import { audioEngine } from '@/services/audioEngine'
import { midiInputService } from '@/services/midiInputService'
import { midiToNoteName } from '@/services/midiService'

// ─── Timing ──────────────────────────────────────────────────────────────────
const FRAME_INTERVAL = 1000 / 30 // ~30 fps
const NOTE_FADE_MS = 400
const PEAK_DECAY_MS = 500
const PARTICLE_LIFETIME_MS = 800
const MAX_PARTICLES = 80

// ─── Geometry ────────────────────────────────────────────────────────────────
const BIN_COUNT = 64 // half — mirrored for 128 visual bars
const DC_SKIP = 9 // skip low DC bins
const ARC_DEG = 270 // degrees of the arc
const ARC_START = (90 + (360 - ARC_DEG) / 2) * (Math.PI / 180) // start angle (rad)
const ARC_END = ARC_START + ARC_DEG * (Math.PI / 180)

// Radius multipliers (of Math.min(w,h)/2)
const R_INNER = 0.18
const R_BAR_BASE = 0.22
const R_BAR_MAX = 0.48

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = [
  '#00d4ff', '#00a0ff', '#3b82f6', '#6c63ff', '#9b59ff',
  '#c850c0', '#d94fdf', '#ff6bd6', '#ff4fa0', '#ff6b6b',
  '#ff9f43', '#ffd93d', '#6bff6b', '#39ff14', '#00ffc8',
]

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
) {
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Glow pass
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

  // ── MIDI subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubOn = midiInputService.onNoteOn((evt) => {
      fadingNotesRef.current = fadingNotesRef.current.filter(f => f.pitch !== evt.pitch)
      const ci = evt.pitch % PALETTE.length
      activeNotesRef.current.set(evt.pitch, {
        velocity: evt.velocity,
        color: PALETTE[ci],
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

      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) / 2
      const rBase = radius * R_BAR_BASE
      const rMax = radius * R_BAR_MAX
      const rInner = radius * R_INNER
      const arcSpan = ARC_END - ARC_START
      const barAngle = arcSpan / BIN_COUNT // angular width per bar
      const smooth = smoothRef.current
      const peaks = peaksRef.current
      const peakTimes = peakTimesRef.current

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
      // Left half: bins 0..63 go clockwise from ARC_START to midpoint
      // Right half: mirror of left (bins 0..63 go counter-clockwise from ARC_END)
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
            // Small bright arc at tip
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

      // ── 4. Inner ring + chord/note display ────────────────────────────
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
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true) // counter-clockwise for ring
        ctx.fillStyle = idleGrad
        ctx.fill()
      }

      // Chord and note text
      const activePitches = [...activeNotesRef.current.keys()]
      const chord = detectChord(activePitches)

      // Prune expired fading notes
      fadingNotesRef.current = fadingNotesRef.current.filter(
        f => now - f.fadeStart < NOTE_FADE_MS
      )

      if (chord) {
        drawGlowText(ctx, chord, cx, cy - 8, 28, '#ffffff', 0.9)
      }

      // Note names below chord (or centered if no chord)
      if (activePitches.length > 0) {
        const noteNames = activePitches
          .sort((a, b) => a - b)
          .map(p => midiToNoteName(p))
          .join('  ')
        const noteY = chord ? cy + 18 : cy
        ctx.globalAlpha = 0.7
        ctx.fillStyle = '#c0c4d8'
        ctx.font = '13px "Share Tech Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteNames, cx, noteY)
        ctx.globalAlpha = 1
      } else if (fadingNotesRef.current.length > 0) {
        // Show fading note names
        const fadeAlpha = Math.max(
          ...fadingNotesRef.current.map(f => Math.max(0, 1 - (now - f.fadeStart) / NOTE_FADE_MS))
        )
        const noteNames = fadingNotesRef.current
          .map(f => midiToNoteName(f.pitch))
          .join('  ')
        ctx.globalAlpha = fadeAlpha * 0.5
        ctx.fillStyle = '#c0c4d8'
        ctx.font = '13px "Share Tech Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteNames, cx, cy)
        ctx.globalAlpha = 1
      }

      // ── 5. Radial particles ───────────────────────────────────────────
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

      // ── 6. CRT overlay: scan-lines + vignette ────────────────────────
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
