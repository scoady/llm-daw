/**
 * ArrangementView — Canvas-based timeline showing tracks and clips.
 * Industrial-futuristic visual style with gradient clips, glow playhead,
 * marching ants selection, and recording overlays.
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useDAWStore } from '@/store/dawStore'
import { ClipContextMenu } from './ClipContextMenu'
import type { Track, Clip } from '@/types'

const TRACK_HEIGHT = 64
const HEADER_HEIGHT = 32
const TRACK_GAP = 1
const BEATS_PER_BAR = 4
const CLIP_HEADER_H = 14

// ─── Color helpers ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

function lighten(hex: string, amount: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)},${alpha})`
}

function darken(hex: string, amount: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)},${alpha})`
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

function drawRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  ppb: number,
  scrollLeft: number,
  loopEnabled: boolean,
  loopStart: number,
  loopEnd: number,
) {
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, HEADER_HEIGHT)
  grad.addColorStop(0, '#1e2230')
  grad.addColorStop(1, '#191c28')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, HEADER_HEIGHT)

  const startBeat = Math.floor(scrollLeft / ppb)
  const endBeat = Math.ceil((scrollLeft + width) / ppb) + 1

  // Loop region in ruler
  if (loopEnabled) {
    const lx = loopStart * ppb - scrollLeft
    const lw = (loopEnd - loopStart) * ppb
    ctx.fillStyle = 'rgba(0, 212, 255, 0.08)'
    ctx.fillRect(lx, 0, lw, HEADER_HEIGHT)
  }

  for (let beat = startBeat; beat <= endBeat; beat++) {
    const x = beat * ppb - scrollLeft

    if (beat % BEATS_PER_BAR === 0) {
      const bar = Math.floor(beat / BEATS_PER_BAR) + 1

      // Bar line
      ctx.strokeStyle = '#2d3348'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, HEADER_HEIGHT)
      ctx.stroke()

      // Bar number
      ctx.fillStyle = '#8890a8'
      ctx.font = '10px "Space Grotesk", sans-serif'
      ctx.fillText(String(bar), x + 4, 13)

      // Marker chevron
      ctx.fillStyle = '#3d4460'
      ctx.beginPath()
      ctx.moveTo(x, HEADER_HEIGHT - 1)
      ctx.lineTo(x + 4, HEADER_HEIGHT - 5)
      ctx.lineTo(x + 8, HEADER_HEIGHT - 1)
      ctx.closePath()
      ctx.fill()
    } else {
      // Beat tick
      ctx.strokeStyle = '#1f2233'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, HEADER_HEIGHT - 6)
      ctx.lineTo(x, HEADER_HEIGHT)
      ctx.stroke()
    }
  }

  // Bottom ridge
  ctx.strokeStyle = '#1f2233'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, HEADER_HEIGHT - 0.5)
  ctx.lineTo(width, HEADER_HEIGHT - 0.5)
  ctx.stroke()

  // Subtle highlight below border
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'
  ctx.beginPath()
  ctx.moveTo(0, HEADER_HEIGHT + 0.5)
  ctx.lineTo(width, HEADER_HEIGHT + 0.5)
  ctx.stroke()
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ppb: number,
  scrollLeft: number,
  tracks: Track[],
  loopEnabled: boolean,
  loopStart: number,
  loopEnd: number,
) {
  const startBeat = Math.floor(scrollLeft / ppb)
  const endBeat = Math.ceil((scrollLeft + width) / ppb) + 1

  // Track lanes with gradient
  tracks.forEach((_, i) => {
    const y = HEADER_HEIGHT + i * (TRACK_HEIGHT + TRACK_GAP)
    const grad = ctx.createLinearGradient(0, y, 0, y + TRACK_HEIGHT)
    if (i % 2 === 0) {
      grad.addColorStop(0, '#21252f')
      grad.addColorStop(0.05, '#1e2230')
      grad.addColorStop(1, '#1c2028')
    } else {
      grad.addColorStop(0, '#1e2230')
      grad.addColorStop(0.05, '#1c2028')
      grad.addColorStop(1, '#1a1e2c')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, y, width, TRACK_HEIGHT)

    // Top ridge separator
    ctx.strokeStyle = 'rgba(255,255,255,0.015)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  })

  // Loop region overlay
  if (loopEnabled) {
    const lx = loopStart * ppb - scrollLeft
    const lw = (loopEnd - loopStart) * ppb
    ctx.fillStyle = 'rgba(0, 212, 255, 0.03)'
    ctx.fillRect(lx, HEADER_HEIGHT, lw, height - HEADER_HEIGHT)
  }

  // Vertical grid lines
  for (let beat = startBeat; beat <= endBeat; beat++) {
    const x = beat * ppb - scrollLeft
    if (beat % BEATS_PER_BAR === 0) {
      // Bar line — glow + crisp
      ctx.strokeStyle = 'rgba(45, 51, 72, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, HEADER_HEIGHT)
      ctx.lineTo(x, height)
      ctx.stroke()

      ctx.strokeStyle = '#2d3348'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, HEADER_HEIGHT)
      ctx.lineTo(x, height)
      ctx.stroke()
    } else if (ppb >= 30) {
      ctx.strokeStyle = '#161921'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, HEADER_HEIGHT)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  trackY: number,
  ppb: number,
  scrollLeft: number,
  color: string,
  selected: boolean,
  dashOffset: number,
) {
  const x = clip.startBeat * ppb - scrollLeft + 1
  const w = clip.durationBeats * ppb - 2
  const y = trackY + 3
  const h = TRACK_HEIGHT - 6

  if (x + w < 0 || x > 10000) return

  const radius = 4

  // Clip body gradient
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, lighten(color, 20, 0.87))
  grad.addColorStop(0.15, lighten(color, 0, 0.8))
  grad.addColorStop(1, darken(color, 30, 0.67))
  ctx.beginPath()
  ctx.roundRect(x, y, Math.max(w, 2), h, radius)
  ctx.fillStyle = grad
  ctx.fill()

  // Inner highlight
  ctx.beginPath()
  ctx.roundRect(x + 1, y + 1, Math.max(w - 2, 1), h - 2, radius - 1)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Clip header bar
  if (w > 20) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.roundRect(x, y, Math.max(w, 2), CLIP_HEADER_H, [radius, radius, 0, 0])
    ctx.fill()

    // Clip name
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '10px "Space Grotesk", sans-serif'
    ctx.fillText(clip.name, x + 5, y + 10, w - 8)
  }

  // MIDI note preview
  if (clip.notes?.length && w > 20) {
    const pitches = clip.notes.map((n) => n.pitch)
    const minP = Math.min(...pitches)
    const maxP = Math.max(...pitches)
    const range = Math.max(maxP - minP, 8)
    const noteAreaTop = y + CLIP_HEADER_H + 2
    const noteArea = h - CLIP_HEADER_H - 4

    // Parse track color for note rendering
    const [cr, cg, cb] = hexToRgb(color)

    // Guard: use actual note span as fallback if durationBeats is 0
    const clipDur = clip.durationBeats > 0
      ? clip.durationBeats
      : Math.max(4, ...clip.notes.map((n) => n.startBeat + n.durationBeats))

    clip.notes.forEach((note) => {
      const nx = x + (note.startBeat / clipDur) * w
      const nh = Math.max(2.5, (noteArea / range) * 0.85)
      const ny = noteAreaTop + noteArea - ((note.pitch - minP + 0.5) / range) * noteArea - nh / 2
      const nw = Math.max(3, (note.durationBeats / clipDur) * w - 1)

      const vel = note.velocity / 127
      const brightness = 1.2 + vel * 0.6

      // Glow behind note
      ctx.fillStyle = `rgba(${Math.min(255, cr * brightness)}, ${Math.min(255, cg * brightness)}, ${Math.min(255, cb * brightness)}, 0.15)`
      ctx.fillRect(nx - 1, ny - 1, nw + 2, nh + 2)

      // Note bar — bright, using track color with velocity-based intensity
      ctx.fillStyle = `rgba(${Math.min(255, cr * brightness)}, ${Math.min(255, cg * brightness)}, ${Math.min(255, cb * brightness)}, ${0.6 + vel * 0.4})`
      ctx.beginPath()
      ctx.roundRect(nx, ny, nw, nh, 1)
      ctx.fill()

      // Top highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + vel * 0.15})`
      ctx.fillRect(nx, ny, nw, 0.5)
    })

    // Note count badge in header
    if (w > 40) {
      const countText = `${clip.notes.length}n`
      ctx.font = '8px "JetBrains Mono", monospace'
      const tw = ctx.measureText(countText).width
      const bx = x + w - tw - 6
      const by = y + 3

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.beginPath()
      ctx.roundRect(bx - 2, by - 1, tw + 4, 10, 3)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fillText(countText, bx, by + 7)
    }
  } else if (!clip.notes?.length && w > 20) {
    // Empty clip — draw subtle indicator
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    const midY = y + CLIP_HEADER_H + (h - CLIP_HEADER_H) / 2
    ctx.beginPath()
    ctx.moveTo(x + 6, midY)
    ctx.lineTo(x + w - 6, midY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Fade handle triangles
  if (w > 60) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    // Left fade
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 8, y)
    ctx.lineTo(x, y + 8)
    ctx.closePath()
    ctx.fill()
    // Right fade
    ctx.beginPath()
    ctx.moveTo(x + w, y)
    ctx.lineTo(x + w - 8, y)
    ctx.lineTo(x + w, y + 8)
    ctx.closePath()
    ctx.fill()
  }

  // Border
  if (selected) {
    // Marching ants
    ctx.setLineDash([4, 4])
    ctx.lineDashOffset = dashOffset
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x, y, Math.max(w, 2), h, radius)
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y, Math.max(w, 2), h, radius)
    ctx.stroke()
  }
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  height: number,
  currentBeat: number,
  ppb: number,
  scrollLeft: number,
  isRecording: boolean,
) {
  const x = currentBeat * ppb - scrollLeft
  const color = isRecording ? '#ff2e63' : '#39ff14'

  // Soft glow (wide)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.08
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()

  // Medium glow
  ctx.globalAlpha = 0.2
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()

  // Sharp center line
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Triangle on ruler
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x - 5, 0)
  ctx.lineTo(x + 5, 0)
  ctx.lineTo(x, 8)
  ctx.closePath()
  ctx.fill()

  // Time label
  const bar = Math.floor(currentBeat / 4) + 1
  const beat = Math.floor(currentBeat % 4) + 1
  const label = `${bar}:${beat}`
  ctx.font = '9px "Share Tech Mono", monospace'
  ctx.fillStyle = color
  const tw = ctx.measureText(label).width
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(x - tw / 2 - 3, 10, tw + 6, 13)
  ctx.fillStyle = color
  ctx.fillText(label, x - tw / 2, 20)
}

function drawRecordingOverlay(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  recordingStartBeat: number | null,
  currentBeat: number,
  ppb: number,
  scrollLeft: number,
) {
  if (recordingStartBeat === null) return

  const armedIdx = tracks.findIndex((t) => t.armed)
  if (armedIdx === -1) return

  const y = HEADER_HEIGHT + armedIdx * (TRACK_HEIGHT + TRACK_GAP)
  const sx = recordingStartBeat * ppb - scrollLeft
  const ex = currentBeat * ppb - scrollLeft

  ctx.fillStyle = 'rgba(255, 46, 99, 0.06)'
  ctx.fillRect(sx, y, ex - sx, TRACK_HEIGHT)

  // Red border
  ctx.strokeStyle = 'rgba(255, 46, 99, 0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(sx, y, ex - sx, TRACK_HEIGHT)
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ArrangementView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const dashOffsetRef = useRef(0)
  const [contextMenu, setContextMenu] = useState<{ clip: Clip; track: Track; x: number; y: number } | null>(null)

  const {
    tracks,
    selectedClipId,
    pixelsPerBeat,
    scrollLeft,
    transport,
    addClip,
    selectClip,
    openPianoRoll,
    setScrollLeft,
  } = useDAWStore()

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setCanvasSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasSize.w === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvasSize.w
    canvas.height = canvasSize.h

    const { w, h } = canvasSize

    // Animate marching ants
    dashOffsetRef.current = (dashOffsetRef.current + 0.3) % 16

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#141620'
    ctx.fillRect(0, 0, w, h)

    drawRuler(ctx, w, pixelsPerBeat, scrollLeft, transport.loopEnabled, transport.loopStart ?? 0, transport.loopEnd ?? 16)
    drawGrid(ctx, w, h, pixelsPerBeat, scrollLeft, tracks, transport.loopEnabled, transport.loopStart ?? 0, transport.loopEnd ?? 16)

    // Recording overlay
    if (transport.isRecording) {
      const { recordingStartBeat } = useDAWStore.getState()
      drawRecordingOverlay(ctx, tracks, recordingStartBeat, transport.currentBeat, pixelsPerBeat, scrollLeft)
    }

    tracks.forEach((track, i) => {
      const trackY = HEADER_HEIGHT + i * (TRACK_HEIGHT + TRACK_GAP)
      track.clips.forEach((clip) => {
        drawClip(ctx, clip, trackY, pixelsPerBeat, scrollLeft, track.color, clip.id === selectedClipId, dashOffsetRef.current)
      })
    })

    drawPlayhead(ctx, h, transport.currentBeat, pixelsPerBeat, scrollLeft, transport.isRecording)
  }, [canvasSize, tracks, selectedClipId, pixelsPerBeat, scrollLeft, transport.currentBeat, transport.isPlaying, transport.isRecording, transport.loopEnabled])

  // Hit-test
  const hitTest = useCallback((cx: number, cy: number): { track?: Track; clip?: Clip } => {
    if (cy < HEADER_HEIGHT) return {}

    const beat = (cx + scrollLeft) / pixelsPerBeat
    const trackIndex = Math.floor((cy - HEADER_HEIGHT) / (TRACK_HEIGHT + TRACK_GAP))

    if (trackIndex < 0 || trackIndex >= tracks.length) return {}
    const track = tracks[trackIndex]

    const clip = [...track.clips].reverse().find((c) =>
      beat >= c.startBeat && beat <= c.startBeat + c.durationBeats
    )

    return { track, clip }
  }, [tracks, scrollLeft, pixelsPerBeat])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    const { track, clip } = hitTest(cx, cy)

    if (clip) {
      selectClip(clip.id)
    } else if (track) {
      const beat = Math.round((cx + scrollLeft) / pixelsPerBeat)
      const snapped = Math.max(0, Math.floor(beat / 4) * 4)
      addClip(track.id, snapped, 4)
      selectClip(null)
    } else {
      selectClip(null)
    }
  }, [hitTest, selectClip, addClip, scrollLeft, pixelsPerBeat])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { clip } = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (clip) openPianoRoll(clip.id)
  }, [hitTest, openPianoRoll])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const { zoomIn, zoomOut } = useDAWStore.getState()
      e.deltaY < 0 ? zoomIn() : zoomOut()
    } else {
      setScrollLeft(scrollLeft + e.deltaX + e.deltaY)
    }
  }, [scrollLeft, setScrollLeft])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const { track, clip } = hitTest(cx, cy)
    if (clip && track) {
      setContextMenu({ clip, track, x: e.clientX, y: e.clientY })
    } else {
      setContextMenu(null)
    }
  }, [hitTest])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ background: '#141620' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <ClipContextMenu
          clip={contextMenu.clip}
          track={contextMenu.track}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
