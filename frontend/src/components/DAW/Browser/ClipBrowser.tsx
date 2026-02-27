import { useEffect, useCallback } from 'react'
import { Search, Music } from 'lucide-react'
import { clsx } from 'clsx'
import { useLibraryStore } from '@/store/libraryStore'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import { LibraryClipCard } from './LibraryClipCard'
import type { LibraryClip, LibraryClipCategory } from '@/types'

const CATEGORIES: { id: LibraryClipCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass' },
  { id: 'melody', label: 'Melody' },
  { id: 'chords', label: 'Chords' },
  { id: 'pads', label: 'Pads' },
  { id: 'fx', label: 'FX' },
]

export function ClipBrowser() {
  const {
    clips, isLoading, selectedCategory, searchQuery, previewingClipId,
    setSelectedCategory, setSearchQuery, setPreviewingClipId, fetchClips,
  } = useLibraryStore()
  const { insertLibraryClip, selectedTrackId, tracks, selectTrack } = useDAWStore()

  useEffect(() => {
    fetchClips()
  }, [selectedCategory, searchQuery, fetchClips])

  const handlePreview = useCallback(async (clip: LibraryClip) => {
    if (!clip.notes?.length) return
    setPreviewingClipId(clip.id)

    // Find a track to use for the synth, or use a one-shot preview
    const trackId = selectedTrackId ?? tracks[0]?.id
    if (trackId) {
      // Play each note through the audio engine
      for (const note of clip.notes) {
        setTimeout(() => {
          audioEngine.previewNote(note.pitch, trackId)
        }, (note.startBeat / (clip.bpm / 60)) * 1000)
      }
    }

    const durationMs = (clip.durationBeats / (clip.bpm / 60)) * 1000
    setTimeout(() => setPreviewingClipId(null), Math.min(durationMs + 500, 4000))
  }, [setPreviewingClipId, selectedTrackId, tracks])

  const handleInsert = useCallback((clip: LibraryClip) => {
    // Ensure a track is selected — fall back to first track
    let targetTrackId = selectedTrackId
    if (!targetTrackId && tracks.length > 0) {
      targetTrackId = tracks[0].id
      selectTrack(targetTrackId)
    }
    if (!targetTrackId) return

    insertLibraryClip(clip, targetTrackId)
  }, [insertLibraryClip, selectedTrackId, tracks, selectTrack])

  return (
    <div className="flex flex-col h-full">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border-subtle/30">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={clsx(
              'px-2 py-0.5 rounded-full text-2xs font-medium transition-all',
              selectedCategory === cat.id
                ? 'text-cyan bg-cyan/15'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-3'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-border-subtle/30">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-2 border border-border-subtle/50">
          <Search size={11} className="text-text-muted/50 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips..."
            className="flex-1 bg-transparent text-xs text-text-secondary placeholder:text-text-muted/40 outline-none"
          />
        </div>
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-2xs font-lcd text-text-muted animate-pulse">Loading...</span>
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Music size={24} className="text-text-muted/30" />
            <span className="text-2xs font-lcd text-text-muted/60 text-center px-4">
              No clips saved yet.
              <br />
              Right-click a clip in the arrangement to save it to the library.
            </span>
          </div>
        ) : (
          clips.map((clip) => (
            <LibraryClipCard
              key={clip.id}
              clip={clip}
              isPreviewing={previewingClipId === clip.id}
              onPreview={handlePreview}
              onInsert={handleInsert}
            />
          ))
        )}
      </div>
    </div>
  )
}
