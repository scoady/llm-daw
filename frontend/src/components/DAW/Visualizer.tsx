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

      // ── Draw waves ────────────────────────────────────────────────────
      const t = timeRef.current
      const waves = [
        { color: '#00d4ff', energy: lowEnergy, speed: 0.8, freq: 1.5, yOff: 0.6, amp: 0.35 },
        { color: '#6c63ff', energy: midEnergy, speed: 1.2, freq: 2.0, yOff: 0.5, amp: 0.30 },
        { color: '#ff6bd6', energy: highEnergy, speed: 1.6, freq: 2.5, yOff: 0.4, amp: 0.25 },
      ]

      for (const wave of waves) {
        const baseAmp = wave.amp * h
        const reactiveAmp = baseAmp * (0.1 + wave.energy * 0.9)
        const centerY = h * wave.yOff

        // Glow pass (wider, transparent)
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        for (let x = 0; x <= w; x += 2) {
          const xNorm = x / w
          const y = centerY +
            Math.sin(xNorm * Math.PI * wave.freq + t * wave.speed) * reactiveAmp +
            Math.sin(xNorm * Math.PI * wave.freq * 0.5 + t * wave.speed * 0.7) * reactiveAmp * 0.3
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = wave.color
        ctx.lineWidth = 6
        ctx.globalAlpha = 0.05 + wave.energy * 0.2
        ctx.stroke()

        // Sharp pass
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        for (let x = 0; x <= w; x += 2) {
          const xNorm = x / w
          const y = centerY +
            Math.sin(xNorm * Math.PI * wave.freq + t * wave.speed) * reactiveAmp +
            Math.sin(xNorm * Math.PI * wave.freq * 0.5 + t * wave.speed * 0.7) * reactiveAmp * 0.3
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = wave.color
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.15 + wave.energy * 0.7
        ctx.stroke()

        ctx.globalAlpha = 1
      }

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
