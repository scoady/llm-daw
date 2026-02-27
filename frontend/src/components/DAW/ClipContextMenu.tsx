import { useEffect, useRef } from 'react'
import { BookmarkPlus, Trash2, Pencil } from 'lucide-react'
import type { Clip, Track, LibraryClipCategory } from '@/types'
import { useDAWStore } from '@/store/dawStore'
import { useLibraryStore } from '@/store/libraryStore'

interface ClipContextMenuProps {
  clip: Clip
  track: Track
  x: number
  y: number
  onClose: () => void
}

function inferCategory(track: Track): LibraryClipCategory {
  const name = (track.name + ' ' + (track.instrument?.presetId ?? '')).toLowerCase()
  if (name.includes('drum') || name.includes('kit') || name.includes('perc')) return 'drums'
  if (name.includes('bass')) return 'bass'
  if (name.includes('pad') || name.includes('ambient')) return 'pads'
  if (name.includes('chord') || name.includes('piano') || name.includes('keys')) return 'chords'
  if (name.includes('lead') || name.includes('melody')) return 'melody'
  if (name.includes('fx') || name.includes('noise') || name.includes('effect')) return 'fx'
  return 'uncategorized'
}

export function ClipContextMenu({ clip, track, x, y, onClose }: ClipContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { bpm, removeClip, openPianoRoll } = useDAWStore()
  const { saveClipToLibrary, setSidebarOpen, setActiveTab } = useLibraryStore()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSaveToLibrary = async () => {
    const category = inferCategory(track)
    await saveClipToLibrary({
      id: crypto.randomUUID(),
      name: clip.name || `${track.name} Clip`,
      category,
      clipType: clip.audioUrl ? 'audio' : 'midi',
      durationBeats: clip.durationBeats,
      bpm,
      color: clip.color || track.color,
      notes: clip.notes?.map((n) => ({ ...n })),
      createdAt: new Date().toISOString(),
    })
    setSidebarOpen(true)
    setActiveTab('clips')
    onClose()
  }

  const handleEdit = () => {
    openPianoRoll(clip.id)
    onClose()
  }

  const handleDelete = () => {
    removeClip(track.id, clip.id)
    onClose()
  }

  // Clamp menu position to viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 140),
    zIndex: 200,
    background: 'linear-gradient(180deg, #1c2030 0%, #1a1d28 100%)',
    border: '1px solid #363c52',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  }

  const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-3 transition-colors text-left'

  return (
    <div ref={ref} className="rounded-lg overflow-hidden py-1" style={menuStyle}>
      <button onClick={handleSaveToLibrary} className={itemClass}>
        <BookmarkPlus size={13} className="text-cyan" />
        Save to Library
      </button>
      <button onClick={handleEdit} className={itemClass}>
        <Pencil size={13} className="text-text-muted" />
        Edit in Piano Roll
      </button>
      <div className="mx-2 my-1 border-t border-border-subtle/30" />
      <button onClick={handleDelete} className={itemClass + ' hover:text-red-400'}>
        <Trash2 size={13} className="text-text-muted" />
        Delete Clip
      </button>
    </div>
  )
}
