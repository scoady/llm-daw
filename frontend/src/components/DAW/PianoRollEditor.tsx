/**
 * PianoRollEditor — Docked piano roll for the bottom panel EDITOR tab.
 * Reuses the canvas-based note grid, piano keys, and velocity lane from PianoRoll.
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { MousePointer2, Pencil, Eraser, Maximize2, Piano } from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore, selectClipById } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import { midiToNoteName, isBlackKey } from '@/services/midiService'
import type { Note } from '@/types'

const KEY_WIDTH = 48
const ROW_HEIGHT = 12
const HEADER_H = 28
const PPB_DEFAULT = 60
const MIDI_MIN = 21
const MIDI_MAX = 108
const TOTAL_ROWS = MIDI_MAX - MIDI_MIN + 1
const VELOCITY_LANE_H = 50

function velocityColor(velocity: number): string {
  const v = velocity / 127
  if (v < 0.3) return `hsl(220, 80%, ${45 + v * 30}%)`
  if (v < 0.6) return `hsl(${220 - (v - 0.3) * 200}, 80%, ${50 + v * 15}%)`
  if (v < 0.85) return `hsl(${60 - (v - 0.6) * 120}, 90%, ${50 + v * 10}%)`
  return `hsl(${0 + (1 - v) * 20}, 90%, 55%)`
}

function noteColor(_pitch: number, velocity: number, selected: boolean): string {
  if (selected) return '#ff6bd6'
  return velocityColor(velocity)
}

// ─── Piano keyboard (left sidebar) ───────────────────────────────────────────
function PianoKeys({
  height,
  scrollTop,
  onPreview,
  activeMidiNotes = [],
}: {
  height: number
  scrollTop: number
  onPreview: (pitch: number) => void
  activeMidiNotes?: number[]
}) {
  const keys: JSX.Element[] = []

  for (let midi = MIDI_MAX; midi >= MIDI_MIN; midi--) {
    const i = MIDI_MAX - midi
    const y = i * ROW_HEIGHT - scrollTop
    if (y + ROW_HEIGHT < 0 || y > height) continue

    const black = isBlackKey(midi)
    const label = midi % 12 === 0 ? midiToNoteName(midi) : ''
    const isActive = activeMidiNotes.includes(midi)

    keys.push(
      <div
        key={midi}
        onMouseDown={() => onPreview(midi)}
        style={{
          position: 'absolute',
          top: HEADER_H + y,
          left: 0,
          width: black ? KEY_WIDTH * 0.65 : KEY_WIDTH,
          height: ROW_HEIGHT - 1,
          background: isActive
            ? '#6c63ff'
            : black
              ? 'linear-gradient(180deg, #2a2a30 0%, #0a0a0f 100%)'
              : 'linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)',
          borderBottom: '1px solid #1f2233',
          borderRight: '1px solid #1f2233',
          cursor: 'pointer',
          zIndex: black ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 4,
          fontSize: 9,
          fontFamily: '"Share Tech Mono", monospace',
          color: isActive ? '#fff' : black ? '#555' : '#444',
          userSelect: 'none',
          transition: 'background 0.08s ease',
          boxShadow: isActive
            ? '0 0 12px rgba(108,99,255,0.6), inset 0 0 4px rgba(108,99,255,0.3)'
            : black
              ? 'inset 0 -1px 2px rgba(0,0,0,0.3)'
              : 'inset 0 -1px 0 rgba(0,0,0,0.05)',
        }}
      >
        {label}
      </div>
    )
  }

  return <div className="relative" style={{ width: KEY_WIDTH, flexShrink: 0 }}>{keys}</div>
}

// ─── Note grid canvas ─────────────────────────────────────────────────────────
function NoteGrid({
  notes,
  clipDuration: _clipDuration,
  ppb,
  scrollLeft,
  scrollTop,
  selectedNoteId,
  onAddNote,
  onDeleteNote,
  onSelectNote,
  currentBeat,
}: {
  notes: Note[]
  clipDuration: number
  ppb: number
  scrollLeft: number
  scrollTop: number
  selectedNoteId: string | null
  onAddNote: (pitch: number, startBeat: number) => void
  onDeleteNote: (id: string) => void
  onSelectNote: (id: string | null) => void
  currentBeat: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    canvas.width = size.w
    canvas.height = size.h
    const ctx = canvas.getContext('2d')!

    ctx.clearRect(0, 0, size.w, size.h)

    const { w, h } = size

    // Ruler gradient
    const rulerGrad = ctx.createLinearGradient(0, 0, 0, HEADER_H)
    rulerGrad.addColorStop(0, '#12151e')
    rulerGrad.addColorStop(1, '#0d1018')
    ctx.fillStyle = rulerGrad
    ctx.fillRect(0, 0, w, HEADER_H)

    // Row backgrounds
    for (let midi = MIDI_MAX; midi >= MIDI_MIN; midi--) {
      const i = MIDI_MAX - midi
      const y = HEADER_H + i * ROW_HEIGHT - scrollTop
      if (y + ROW_HEIGHT < 0 || y > h) continue

      if (isBlackKey(midi)) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
      } else if (midi % 12 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
      } else {
        ctx.fillStyle = 'transparent'
      }
      ctx.fillRect(0, y, w, ROW_HEIGHT - 1)
    }

    // Vertical grid (beats)
    const startBeat = Math.floor(scrollLeft / ppb)
    const endBeat = Math.ceil((scrollLeft + w) / ppb) + 1
    for (let b = startBeat; b <= endBeat; b++) {
      const x = b * ppb - scrollLeft
      ctx.strokeStyle = b % 4 === 0 ? '#2d3348' : '#1a1d2a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, HEADER_H)
      ctx.lineTo(x, h)
      ctx.stroke()

      if (b % 4 === 0) {
        ctx.fillStyle = '#8890a8'
        ctx.font = '9px "Share Tech Mono", monospace'
        ctx.fillText(`${b / 4 + 1}`, x + 2, 18)
      }
    }

    // Horizontal separator every octave
    for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
      if (midi % 12 === 0) {
        const i = MIDI_MAX - midi
        const y = HEADER_H + i * ROW_HEIGHT - scrollTop
        ctx.strokeStyle = '#2d3348'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
    }

    // Notes
    for (const note of notes) {
      const rowIdx = MIDI_MAX - note.pitch
      const y = HEADER_H + rowIdx * ROW_HEIGHT - scrollTop + 1
      const x = note.startBeat * ppb - scrollLeft
      const nw = Math.max(note.durationBeats * ppb - 1, 4)

      if (y + ROW_HEIGHT < 0 || y > h || x + nw < 0 || x > w) continue

      const selected = note.id === selectedNoteId
      const color = noteColor(note.pitch, note.velocity, selected)

      // Note body
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(x, y, nw, ROW_HEIGHT - 2, 2)
      ctx.fill()

      // Top highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x + 2, y + 0.5)
      ctx.lineTo(x + nw - 2, y + 0.5)
      ctx.stroke()

      // Bottom shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.moveTo(x + 2, y + ROW_HEIGHT - 2.5)
      ctx.lineTo(x + nw - 2, y + ROW_HEIGHT - 2.5)
      ctx.stroke()

      // Selection glow
      if (selected) {
        ctx.strokeStyle = '#ff6bd6'
        ctx.lineWidth = 1.5
        ctx.shadowColor = '#ff6bd6'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.roundRect(x, y, nw, ROW_HEIGHT - 2, 2)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }

    // Playhead
    const px = currentBeat * ppb - scrollLeft
    ctx.strokeStyle = '#39ff14'
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(px, HEADER_H)
    ctx.lineTo(px, h)
    ctx.stroke()
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, HEADER_H)
    ctx.lineTo(px, h)
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [size, notes, ppb, scrollLeft, scrollTop, selectedNoteId, currentBeat])

  const hitTestNote = useCallback((cx: number, cy: number): Note | null => {
    const beat = (cx + scrollLeft) / ppb
    const rowI = Math.floor((cy - HEADER_H + scrollTop) / ROW_HEIGHT)
    const pitch = MIDI_MAX - rowI
    return notes.find(
      (n) =>
        n.pitch === pitch &&
        beat >= n.startBeat &&
        beat <= n.startBeat + n.durationBeats
    ) ?? null
  }, [notes, scrollLeft, ppb, scrollTop])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    if (cy < HEADER_H) return

    if (e.button === 2) {
      const note = hitTestNote(cx, cy)
      if (note) onDeleteNote(note.id)
      return
    }

    const note = hitTestNote(cx, cy)
    if (note) {
      onSelectNote(note.id)
    } else {
      const beat = Math.round((cx + scrollLeft) / ppb * 4) / 4
      const rowI = Math.floor((cy - HEADER_H + scrollTop) / ROW_HEIGHT)
      const pitch = MIDI_MAX - rowI
      if (pitch >= MIDI_MIN && pitch <= MIDI_MAX) {
        onAddNote(pitch, beat)
      }
      onSelectNote(null)
    }
  }, [hitTestNote, onDeleteNote, onSelectNote, onAddNote, scrollLeft, ppb, scrollTop])

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}

// ─── Velocity Lane ───────────────────────────────────────────────────────────
function VelocityLane({
  notes,
  ppb,
  scrollLeft,
  selectedNoteId,
}: {
  notes: Note[]
  ppb: number
  scrollLeft: number
  selectedNoteId: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    canvas.width = size.w
    canvas.height = size.h
    const ctx = canvas.getContext('2d')!

    ctx.clearRect(0, 0, size.w, size.h)

    // Background
    ctx.fillStyle = '#0a0c12'
    ctx.fillRect(0, 0, size.w, size.h)

    // Grid lines at velocity levels
    for (const vLevel of [0.25, 0.5, 0.75]) {
      const y = size.h - vLevel * size.h
      ctx.strokeStyle = '#1a1d2a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size.w, y)
      ctx.stroke()
    }

    // Velocity bars
    for (const note of notes) {
      const x = note.startBeat * ppb - scrollLeft
      const barW = Math.max(3, note.durationBeats * ppb * 0.3)
      const velNorm = note.velocity / 127
      const barH = velNorm * (size.h - 4)

      if (x + barW < 0 || x > size.w) continue

      const selected = note.id === selectedNoteId
      ctx.fillStyle = selected ? '#ff6bd6' : velocityColor(note.velocity)
      ctx.globalAlpha = selected ? 0.9 : 0.7
      ctx.fillRect(x, size.h - barH - 2, barW, barH)
    }
    ctx.globalAlpha = 1

    // Label
    ctx.fillStyle = '#4a5068'
    ctx.font = '8px "Share Tech Mono", monospace'
    ctx.fillText('VEL', 3, 10)
  }, [size, notes, ppb, scrollLeft, selectedNoteId])

  return (
    <div ref={containerRef} className="relative border-t border-border-subtle" style={{ height: VELOCITY_LANE_H }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Scan-line overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      {/* Dimmed piano key silhouettes */}
      <div className="absolute inset-0 flex items-end justify-center opacity-[0.04] pointer-events-none">
        <div className="flex gap-[1px] h-[60%]">
          {Array.from({ length: 24 }).map((_, i) => {
            const isBlack = [1, 3, 6, 8, 10].includes(i % 12)
            return (
              <div
                key={i}
                className="rounded-b"
                style={{
                  width: isBlack ? 8 : 12,
                  height: isBlack ? '60%' : '100%',
                  background: isBlack ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              />
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 z-10">
        <Piano size={32} className="text-accent/30" />
        <span
          className="text-sm font-lcd text-accent/50 tracking-wider"
          style={{
            textShadow: '0 0 12px rgba(108, 99, 255, 0.3)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        >
          SELECT A CLIP TO EDIT
        </span>
        <span className="text-2xs text-text-muted/40 font-lcd">
          Double-click a clip in the arrangement
        </span>
      </div>
    </div>
  )
}

// ─── Main Docked Piano Roll Editor ──────────────────────────────────────────
export function PianoRollEditor() {
  const {
    pianoRollClipId,
    transport,
    addNote,
    removeNote,
    selectedTrackId,
    activeMidiNotes,
  } = useDAWStore()

  const [ppb, setPpb] = useState(PPB_DEFAULT)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(TOTAL_ROWS * ROW_HEIGHT * 0.4)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<'pointer' | 'pencil' | 'eraser' | 'select'>('pencil')
  const [snap, setSnap] = useState('1/4')

  const clip = pianoRollClipId
    ? selectClipById(pianoRollClipId)(useDAWStore.getState())
    : undefined

  const notes = clip?.notes ?? []

  const handleAddNote = useCallback((pitch: number, startBeat: number) => {
    if (!pianoRollClipId) return
    addNote(pianoRollClipId, {
      pitch,
      startBeat,
      durationBeats: 1,
      velocity: 100,
    })
  }, [pianoRollClipId, addNote])

  const handleDeleteNote = useCallback((noteId: string) => {
    if (!pianoRollClipId) return
    removeNote(pianoRollClipId, noteId)
    setSelectedNoteId(null)
  }, [pianoRollClipId, removeNote])

  const handlePreviewKey = useCallback((pitch: number) => {
    audioEngine.previewNote(pitch, selectedTrackId ?? undefined)
  }, [selectedTrackId])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      setPpb((p) => Math.max(20, Math.min(200, p * (e.deltaY < 0 ? 1.2 : 0.85))))
    } else if (e.shiftKey) {
      setScrollLeft((s) => Math.max(0, s + e.deltaY))
    } else {
      setScrollTop((s) => Math.max(0, s + e.deltaY))
    }
  }, [])

  // Empty state
  if (!pianoRollClipId || !clip) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#0a0c12' }}>
        <EmptyState />
      </div>
    )
  }

  const clipName = clip?.name ?? 'Piano Roll'
  const clipDuration = clip?.durationBeats ?? 16

  const tools = [
    { id: 'pointer' as const, icon: MousePointer2, label: 'Select' },
    { id: 'pencil' as const, icon: Pencil, label: 'Draw' },
    { id: 'eraser' as const, icon: Eraser, label: 'Erase' },
    { id: 'select' as const, icon: Maximize2, label: 'Marquee' },
  ]

  const snapValues = ['1/4', '1/8', '1/16']

  return (
    <div className="flex flex-col h-full" onWheel={handleWheel}>
      {/* Compact toolbar */}
      <div
        className="flex items-center gap-2 px-3 h-[28px] flex-shrink-0 border-b border-border-subtle/50"
        style={{
          background: 'linear-gradient(180deg, #13161f 0%, #0d1018 100%)',
        }}
      >
        {/* Clip name */}
        <span className="text-2xs text-accent font-lcd tracking-wider truncate max-w-[120px]">
          {clipName}
        </span>

        <div className="w-px h-3 bg-border-subtle/30" />

        {/* Tool icons */}
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className={clsx(
                'transport-btn !w-6 !h-6',
                activeTool === tool.id && 'active'
              )}
            >
              <tool.icon size={10} />
            </button>
          ))}
        </div>

        <div className="w-px h-3 bg-border-subtle/30" />

        {/* Snap grid */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted/60 font-lcd">SNAP</span>
          {snapValues.map((sv) => (
            <button
              key={sv}
              onClick={() => setSnap(sv)}
              className={clsx(
                'px-1 py-0.5 rounded text-2xs font-lcd transition-colors',
                snap === sv
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-text-muted/50 hover:text-text-secondary border border-transparent'
              )}
            >
              {sv}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <span className="text-2xs text-text-muted/50 font-lcd">{notes.length} notes</span>

        <div className="w-px h-3 bg-border-subtle/30" />

        <button
          className="text-2xs text-text-muted/50 hover:text-text-primary font-lcd"
          onClick={() => setPpb((p) => Math.min(200, p * 1.25))}
        >
          +
        </button>
        <button
          className="text-2xs text-text-muted/50 hover:text-text-primary font-lcd"
          onClick={() => setPpb((p) => Math.max(20, p * 0.8))}
        >
          -
        </button>
      </div>

      {/* Content: piano keys + note grid + velocity lane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Piano keys */}
        <div className="flex flex-col overflow-hidden" style={{ width: KEY_WIDTH }}>
          <div style={{ height: HEADER_H, flexShrink: 0 }} className="border-b border-border-subtle bg-surface-1" />
          <div className="flex-1 overflow-hidden relative">
            <PianoKeys
              height={800}
              scrollTop={scrollTop}
              onPreview={handlePreviewKey}
              activeMidiNotes={activeMidiNotes}
            />
          </div>
          {/* Velocity lane spacer */}
          <div style={{ height: VELOCITY_LANE_H }} className="border-t border-border-subtle bg-surface-1" />
        </div>

        {/* Note grid + velocity lane */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <NoteGrid
            notes={notes}
            clipDuration={clipDuration}
            ppb={ppb}
            scrollLeft={scrollLeft}
            scrollTop={scrollTop}
            selectedNoteId={selectedNoteId}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onSelectNote={setSelectedNoteId}
            currentBeat={transport.currentBeat}
          />
          <VelocityLane
            notes={notes}
            ppb={ppb}
            scrollLeft={scrollLeft}
            selectedNoteId={selectedNoteId}
          />
        </div>
      </div>
    </div>
  )
}
