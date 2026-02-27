/**
 * MasterEQ — Spectrum analyzer canvas + 3-band EQ + master output section.
 * The visual showpiece of the bottom panel.
 */
import { useRef, useEffect, useCallback } from 'react'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import { Knob } from '@/components/common/Knob'
import { Slider } from '@/components/common/Slider'
import { VUMeter, useSimulatedLevel } from '@/components/common/VUMeter'

// ─── Spectrum Analyzer Canvas ────────────────────────────────────────────────

function SpectrumAnalyzer({ eqLow, eqMid, eqHigh }: { eqLow: number; eqMid: number; eqHigh: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const scanLineOffset = useRef(0)

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

  useEffect(() => {
    let lastFrame = 0
    const FRAME_INTERVAL = 1000 / 30 // ~30fps

    const draw = (timestamp: number) => {
      animRef.current = requestAnimationFrame(draw)

      if (timestamp - lastFrame < FRAME_INTERVAL) return
      lastFrame = timestamp

      const canvas = canvasRef.current
      if (!canvas) return
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) return

      const ctx = canvas.getContext('2d')!
      const fftData = audioEngine.getFrequencyData()

      // Clear with dark gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, '#141620')
      bgGrad.addColorStop(1, '#181b24')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      // Subtle grid
      ctx.strokeStyle = 'rgba(45, 51, 72, 0.2)'
      ctx.lineWidth = 0.5

      // Horizontal dB grid lines
      const dbLevels = [-12, -6, 0, 6, 12]
      const centerY = h * 0.5
      for (const db of dbLevels) {
        const y = centerY - (db / 24) * h * 0.8
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()

        // dB labels
        ctx.fillStyle = 'rgba(74, 80, 104, 0.5)'
        ctx.font = '8px "Share Tech Mono", monospace'
        ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 3, y - 2)
      }

      // Vertical frequency grid lines
      const freqMarkers = [
        { hz: 20, label: '20' },
        { hz: 100, label: '100' },
        { hz: 200, label: '200' },
        { hz: 1000, label: '1k' },
        { hz: 1500, label: '1.5k' },
        { hz: 5000, label: '5k' },
        { hz: 8000, label: '8k' },
        { hz: 10000, label: '10k' },
        { hz: 20000, label: '20k' },
      ]
      for (const { hz, label } of freqMarkers) {
        const x = freqToX(hz, w)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()

        ctx.fillStyle = 'rgba(74, 80, 104, 0.4)'
        ctx.font = '8px "Share Tech Mono", monospace'
        ctx.fillText(label, x + 2, h - 4)
      }

      // FFT bars
      const barCount = Math.min(fftData.length, 128)
      const barWidth = Math.max(2, (w / barCount) - 1)

      for (let i = 0; i < barCount; i++) {
        // Map FFT bin to x position (logarithmic)
        const freq = (i / barCount) * 22050
        const x = freqToX(Math.max(20, freq), w)

        // Normalize dB value (-100 to 0) to 0-1
        const db = fftData[i]
        const normalized = Math.max(0, Math.min(1, (db + 80) / 80))
        const barH = normalized * h * 0.85

        if (barH < 1) continue

        // Color gradient: cyan → accent purple → neon pink
        const t = i / barCount
        const color = spectrumColor(t)

        // Glow pass (wider, transparent)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.roundRect(x - 1, h - barH - 2, barWidth + 2, barH + 2, 2)
        ctx.fill()

        // Solid pass
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.roundRect(x, h - barH, barWidth, barH, [2, 2, 0, 0])
        ctx.fill()

        ctx.globalAlpha = 1
      }

      // EQ curve overlay
      drawEQCurve(ctx, w, h, eqLow, eqMid, eqHigh)

      // Scan-line overlay (scrolling CRT effect)
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

      // Noise texture overlay
      ctx.globalAlpha = 0.02
      for (let i = 0; i < 200; i++) {
        const nx = Math.random() * w
        const ny = Math.random() * h
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
        ctx.fillRect(nx, ny, 1, 1)
      }
      ctx.globalAlpha = 1
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [eqLow, eqMid, eqHigh])

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden rounded" style={{ minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          border: '1px solid rgba(108, 99, 255, 0.1)',
          borderRadius: 4,
        }}
      />
    </div>
  )
}

// Frequency to X position (logarithmic scale)
function freqToX(hz: number, width: number): number {
  const minLog = Math.log10(20)
  const maxLog = Math.log10(20000)
  const t = (Math.log10(Math.max(20, hz)) - minLog) / (maxLog - minLog)
  return t * width
}

// Spectrum bar color: cyan → purple → pink
function spectrumColor(t: number): string {
  if (t < 0.33) {
    const p = t / 0.33
    const r = Math.round(0 + p * 108)
    const g = Math.round(212 - p * 113)
    const b = Math.round(255 - p * 0)
    return `rgb(${r}, ${g}, ${b})`
  } else if (t < 0.66) {
    const p = (t - 0.33) / 0.33
    const r = Math.round(108 + p * 147)
    const g = Math.round(99 - p * 92)
    const b = Math.round(255 - p * 41)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    return '#ff6bd6'
  }
}

// Draw smooth EQ curve overlay
function drawEQCurve(ctx: CanvasRenderingContext2D, w: number, h: number, low: number, mid: number, high: number) {
  if (low === 0 && mid === 0 && high === 0) return

  const centerY = h * 0.5
  const points: { x: number; y: number }[] = []

  // Generate curve points across the frequency range
  for (let px = 0; px < w; px += 2) {
    const t = px / w
    const minLog = Math.log10(20)
    const maxLog = Math.log10(20000)
    const freq = Math.pow(10, minLog + t * (maxLog - minLog))

    // Simple 3-band EQ response approximation
    let gain = 0

    // Low shelf (~200Hz)
    const lowT = 1 / (1 + Math.pow(freq / 200, 2))
    gain += low * lowT

    // Mid bell (~1500Hz)
    const midWidth = 2.0
    const midT = Math.exp(-Math.pow(Math.log10(freq / 1500), 2) * midWidth * midWidth)
    gain += mid * midT

    // High shelf (~8000Hz)
    const highT = 1 / (1 + Math.pow(8000 / freq, 2))
    gain += high * highT

    const y = centerY - (gain / 24) * h * 0.8
    points.push({ x: px, y })
  }

  if (points.length < 2) return

  // Filled area
  ctx.beginPath()
  ctx.moveTo(points[0].x, centerY)
  for (const p of points) {
    ctx.lineTo(p.x, p.y)
  }
  ctx.lineTo(points[points.length - 1].x, centerY)
  ctx.closePath()

  const fillGrad = ctx.createLinearGradient(0, 0, w, 0)
  fillGrad.addColorStop(0, 'rgba(0, 212, 255, 0.08)')
  fillGrad.addColorStop(0.5, 'rgba(108, 99, 255, 0.1)')
  fillGrad.addColorStop(1, 'rgba(255, 107, 214, 0.08)')
  ctx.fillStyle = fillGrad
  ctx.fill()

  // Stroke line with glow
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }

  // Glow pass
  ctx.strokeStyle = 'rgba(108, 99, 255, 0.3)'
  ctx.lineWidth = 4
  ctx.stroke()

  // Sharp pass
  const lineGrad = ctx.createLinearGradient(0, 0, w, 0)
  lineGrad.addColorStop(0, '#00d4ff')
  lineGrad.addColorStop(0.5, '#6c63ff')
  lineGrad.addColorStop(1, '#ff6bd6')
  ctx.strokeStyle = lineGrad
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Band node dots
  const bandFreqs = [200, 1500, 8000]
  const bandGains = [low, mid, high]
  const bandColors = ['#00d4ff', '#6c63ff', '#ff6bd6']

  for (let i = 0; i < 3; i++) {
    const x = freqToX(bandFreqs[i], w)
    const y = centerY - (bandGains[i] / 24) * h * 0.8

    // Outer glow
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = bandColors[i]
    ctx.globalAlpha = 0.2
    ctx.fill()

    // Inner dot
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = bandColors[i]
    ctx.globalAlpha = 1
    ctx.fill()

    // White center
    ctx.beginPath()
    ctx.arc(x, y, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
}

// ─── EQ Controls Row ─────────────────────────────────────────────────────────

function EQControls() {
  const { masterEQ, setMasterEQ } = useDAWStore()

  const bands = [
    { key: 'low' as const, label: 'LOW', freq: '200 Hz', color: '#00d4ff', value: masterEQ.low },
    { key: 'mid' as const, label: 'MID', freq: '1.5 kHz', color: '#6c63ff', value: masterEQ.mid },
    { key: 'high' as const, label: 'HIGH', freq: '8 kHz', color: '#ff6bd6', value: masterEQ.high },
  ]

  const handleChange = useCallback((band: 'low' | 'mid' | 'high', value: number) => {
    setMasterEQ(band, value)
    audioEngine.setMasterEQ(
      band === 'low' ? value : masterEQ.low,
      band === 'mid' ? value : masterEQ.mid,
      band === 'high' ? value : masterEQ.high,
    )
  }, [masterEQ, setMasterEQ])

  return (
    <div className="flex items-center justify-center gap-8 px-4 py-2 flex-shrink-0">
      {bands.map((band) => {
        const dbDisplay = band.value > 0 ? `+${band.value.toFixed(1)}` : band.value.toFixed(1)
        const isActive = Math.abs(band.value) > 0.5
        return (
          <div key={band.key} className="flex flex-col items-center gap-1">
            <Knob
              value={band.value}
              onChange={(v) => handleChange(band.key, v)}
              min={-12}
              max={12}
              size="lg"
              bipolar
              color={band.color}
            />
            {/* dB readout */}
            <span
              className="text-xs font-lcd tabular-nums"
              style={{
                color: isActive ? band.color : 'rgba(136, 144, 168, 0.6)',
                textShadow: isActive ? `0 0 8px ${band.color}40` : 'none',
              }}
            >
              {dbDisplay} dB
            </span>
            {/* Label + freq */}
            <span className="text-2xs font-lcd text-text-muted/50 tracking-wider">
              {band.label} <span className="text-text-muted/30">{band.freq}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Master Output Section (right side) ──────────────────────────────────────

function MasterOutput() {
  const levelL = useSimulatedLevel(0.45, 0.15)
  const levelR = useSimulatedLevel(0.42, 0.14)

  return (
    <div
      className="flex flex-col items-center gap-1.5 px-3 py-2 border-l border-border-subtle/30 flex-shrink-0"
      style={{
        width: 100,
        background: 'linear-gradient(180deg, #191c28 0%, #141620 100%)',
      }}
    >
      {/* Label */}
      <span
        className="text-2xs font-lcd tracking-[0.12em] text-text-muted/60 uppercase"
        style={{ textShadow: '0 0 6px rgba(57, 255, 20, 0.1)' }}
      >
        MASTER
      </span>

      {/* Stereo VU + Fader */}
      <div className="flex items-stretch gap-1.5 flex-1 w-full" style={{ minHeight: 0 }}>
        <VUMeter level={levelL} segments={16} height={140} width={5} />
        <VUMeter level={levelR} segments={16} height={140} width={5} />
        <div className="flex-1">
          <Slider
            value={0.9}
            onChange={() => {}}
            min={0}
            max={1}
            vertical
            fillColor="rgba(57, 255, 20, 0.4)"
          />
        </div>
      </div>

      {/* dB readout */}
      <span
        className="text-xs font-lcd tabular-nums"
        style={{
          color: '#39ff14',
          textShadow: '0 0 8px rgba(57, 255, 20, 0.4)',
        }}
      >
        -1.0 dB
      </span>

      {/* Output label */}
      <span className="text-2xs font-lcd text-text-muted/30 tracking-wider">
        OUTPUT
      </span>
    </div>
  )
}

// ─── Main MasterEQ Component ─────────────────────────────────────────────────

export function MasterEQ() {
  const { masterEQ } = useDAWStore()

  return (
    <div className="flex flex-col h-full" style={{ background: '#161922' }}>
      {/* Main content: Spectrum + Master Output */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Spectrum analyzer + EQ controls */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Spectrum canvas */}
          <div className="flex flex-col flex-1 p-2 pb-0 min-h-0">
            <SpectrumAnalyzer
              eqLow={masterEQ.low}
              eqMid={masterEQ.mid}
              eqHigh={masterEQ.high}
            />
          </div>

          {/* EQ knobs row */}
          <EQControls />
        </div>

        {/* Master output section */}
        <MasterOutput />
      </div>
    </div>
  )
}
