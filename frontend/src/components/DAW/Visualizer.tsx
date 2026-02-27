/**
 * Visualizer — FFT frequency bars + floating particles behind the Mixer tab.
 * Each bar gets a random color and lights up when its frequency bin is active.
 * CRT scan-line/vignette overlay for retro feel.
 */
import { useRef, useEffect } from 'react'
import { audioEngine } from '@/services/audioEngine'

const FRAME_INTERVAL = 1000 / 30 // ~30fps
const PARTICLE_COUNT = 50
const BAR_COUNT = 64

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
