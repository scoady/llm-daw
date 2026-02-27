import { useRef, useEffect } from 'react'
import { Play, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { LibraryClip } from '@/types'

interface LibraryClipCardProps {
  clip: LibraryClip
  isPreviewing: boolean
  onPreview: (clip: LibraryClip) => void
  onInsert: (clip: LibraryClip) => void
}

function MiniNotePreview({ clip }: { clip: LibraryClip }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !clip.notes?.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const notes = clip.notes
    const pitches = notes.map((n) => n.pitch)
    const minP = Math.min(...pitches)
    const maxP = Math.max(...pitches)
    const range = Math.max(maxP - minP, 4)
    const dur = clip.durationBeats || 4

    for (const note of notes) {
      const x = (note.startBeat / dur) * w
      const nw = Math.max(1.5, (note.durationBeats / dur) * w)
      const y = h - ((note.pitch - minP) / range) * (h - 3) - 2

      ctx.fillStyle = 'rgba(0, 212, 255, 0.6)'
      ctx.fillRect(x, y, nw, 2)
    }
  }, [clip])

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={28}
      className="w-full h-[28px] rounded"
      style={{ background: 'rgba(0, 212, 255, 0.03)' }}
    />
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  drums: '#ff9f1c',
  bass: '#ef4444',
  melody: '#6c63ff',
  chords: '#22c55e',
  pads: '#06b6d4',
  fx: '#ec4899',
  uncategorized: '#6b7280',
}

export function LibraryClipCard({ clip, isPreviewing, onPreview, onInsert }: LibraryClipCardProps) {
  const catColor = CATEGORY_COLORS[clip.category] ?? CATEGORY_COLORS.uncategorized

  return (
    <div
      className="group px-2 py-2 border-b border-border-subtle/30 hover:bg-surface-3/50 transition-colors"
    >
      {/* Color accent + info */}
      <div className="flex items-start gap-2">
        {/* Left color bar */}
        <div
          className="w-[3px] h-[36px] rounded-full flex-shrink-0 mt-0.5"
          style={{ background: clip.color || catColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Name + category badge */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-medium text-text-secondary truncate">
              {clip.name}
            </span>
            <span
              className="text-2xs px-1.5 py-0.5 rounded font-lcd uppercase tracking-wider flex-shrink-0"
              style={{ color: catColor, background: catColor + '15' }}
            >
              {clip.category}
            </span>
          </div>

          {/* Note preview */}
          {clip.clipType === 'midi' && (clip.notes?.length || (clip.noteCount ?? 0) > 0) && (
            <MiniNotePreview clip={clip} />
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs font-lcd text-text-muted">
              {clip.durationBeats}b
            </span>
            <span className="text-2xs font-lcd text-text-muted/40">|</span>
            <span className="text-2xs font-lcd text-text-muted">
              {clip.bpm} BPM
            </span>
            {clip.clipType === 'audio' && (
              <>
                <span className="text-2xs font-lcd text-text-muted/40">|</span>
                <span className="text-2xs font-lcd text-cyan/60">audio</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onPreview(clip)}
            className={clsx(
              'p-1 rounded hover:bg-surface-4 transition-colors',
              isPreviewing ? 'text-cyan' : 'text-text-muted'
            )}
            title="Preview"
          >
            <Play size={12} className={isPreviewing ? 'animate-pulse' : ''} />
          </button>
          <button
            onClick={() => onInsert(clip)}
            className="p-1 rounded hover:bg-cyan/20 text-text-muted hover:text-cyan transition-colors"
            title="Insert into track"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
