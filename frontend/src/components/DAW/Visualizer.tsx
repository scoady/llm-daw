/**
 * Visualizer — Retro wave + particle background for the Mixer tab.
 * Renders flowing sine waves driven by FFT data, floating particles,
 * and a CRT scan-line/vignette overlay. Ambient drift when idle.
 */
import { useRef, useEffect } from 'react'
import { audioEngine } from '@/services/audioEngine'

const FRAME_INTERVAL = 1000 / 30 // ~30fps
const PARTICLE_COUNT = 50

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
  const colors = ['#00d4ff', '#6c63ff', '#ff6bd6']
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(Math.random() * 0.4 + 0.1),
    radius: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
    color: colors[Math.floor(Math.random() * colors.length)],
  }
}

// ─── Visualizer Component ─────────────────────────────────────────────────────

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const particlesRef = useRef<Particle[]>([])
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

      // ── Compute energy bands ──────────────────────────────────────────
      const binCount = fftData.length
      let lowEnergy = 0
      let midEnergy = 0
      let highEnergy = 0
      const lowEnd = Math.floor(binCount * 0.15)
      const midEnd = Math.floor(binCount * 0.5)

      for (let i = 0; i < binCount; i++) {
        const norm = Math.max(0, (fftData[i] + 80) / 80)
        if (i < lowEnd) lowEnergy += norm
        else if (i < midEnd) midEnergy += norm
        else highEnergy += norm
      }

      lowEnergy = Math.min(1, (lowEnergy / Math.max(1, lowEnd)) ** 0.6 * 2.5)
      midEnergy = Math.min(1, (midEnergy / Math.max(1, midEnd - lowEnd)) ** 0.6 * 2.5)
      highEnergy = Math.min(1, (highEnergy / Math.max(1, binCount - midEnd)) ** 0.6 * 2.5)
      const totalEnergy = (lowEnergy + midEnergy + highEnergy) / 3

      // ── Clear ─────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h)

      // ── Draw wave (full FFT spectrum with gradient) ─────────────────
      const t = timeRef.current
      const centerY = h * 0.5
      const maxAmp = h * 0.35

      // Build y-values: map all FFT bins across canvas width
      const yValues: number[] = []
      for (let x = 0; x <= w; x += 2) {
        const xNorm = x / w
        const binIndex = Math.min(binCount - 1, Math.floor(xNorm * binCount))
        const fftVal = Math.max(0, (fftData[binIndex] + 80) / 80)
        const fftDisplace = fftVal * maxAmp * (0.5 + totalEnergy * 0.5)
        const idleSine = Math.sin(xNorm * Math.PI * 2 + t * 0.8) * h * 0.03
        yValues.push(centerY + idleSine - fftDisplace)
      }

      // Smooth the curve (3-tap)
      const smooth: number[] = []
      for (let i = 0; i < yValues.length; i++) {
        const prev = yValues[Math.max(0, i - 1)]
        const curr = yValues[i]
        const next = yValues[Math.min(yValues.length - 1, i + 1)]
        smooth.push(prev * 0.2 + curr * 0.6 + next * 0.2)
      }

      // Gradient: cyan → blue → purple → magenta → pink
      const gradient = ctx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, '#00d4ff')
      gradient.addColorStop(0.2, '#00a0ff')
      gradient.addColorStop(0.4, '#6c63ff')
      gradient.addColorStop(0.6, '#9b59ff')
      gradient.addColorStop(0.8, '#d94fdf')
      gradient.addColorStop(1, '#ff6bd6')

      // Glow pass
      ctx.beginPath()
      ctx.moveTo(0, smooth[0])
      for (let i = 1; i < smooth.length; i++) {
        ctx.lineTo(i * 2, smooth[i])
      }
      ctx.strokeStyle = gradient
      ctx.lineWidth = 8
      ctx.globalAlpha = 0.08 + totalEnergy * 0.15
      ctx.stroke()

      // Sharp pass
      ctx.beginPath()
      ctx.moveTo(0, smooth[0])
      for (let i = 1; i < smooth.length; i++) {
        ctx.lineTo(i * 2, smooth[i])
      }
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.3 + totalEnergy * 0.6
      ctx.stroke()

      ctx.globalAlpha = 1

      // ── Draw particles ────────────────────────────────────────────────
      // Lazy-init particles
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particlesRef.current.push(createParticle(w, h))
        }
      }

      for (const p of particlesRef.current) {
        // Update position
        const speedMult = 0.3 + totalEnergy * 3.0
        p.x += p.vx + Math.sin(t + p.y * 0.01) * 0.2
        p.y += p.vy * speedMult

        // Wrap around
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10

        const brightAlpha = p.alpha * (0.2 + totalEnergy * 1.5)

        // Glow pass
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

      // Vignette
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
