import { Plus } from 'lucide-react'
import { useDAWStore } from '@/store/dawStore'
import { TrackHeader } from './TrackHeader'
import { Button } from '@/components/common/Button'
import { LEDIndicator } from '@/components/common/LEDIndicator'

export function TrackPanel() {
  const {
    tracks,
    selectedTrackId,
    selectTrack,
    addTrack,
    scrollTop,
  } = useDAWStore()

  return (
    <div
      className="flex flex-col border-r border-border-subtle select-none noise-texture"
      style={{
        width: 220,
        background: 'linear-gradient(180deg, #1c2030 0%, #1a1d28 100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border-subtle h-[32px]"
        style={{ background: 'linear-gradient(180deg, #1e2230 0%, #191c28 100%)' }}
      >
        <div className="flex items-center gap-2">
          <LEDIndicator on={tracks.length > 0} color="cyan" size="xs" />
          <span className="text-2xs text-text-muted uppercase tracking-[0.15em] font-lcd font-medium">
            Tracks
          </span>
          <span className="text-2xs text-text-muted font-lcd">({tracks.length})</span>
        </div>
        <button
          onClick={() => addTrack('midi')}
          title="Add MIDI track"
          className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-surface-3"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Track list */}
      <div
        className="flex-1 overflow-hidden"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {tracks.map((track, i) => (
          <TrackHeader
            key={track.id}
            track={track}
            selected={track.id === selectedTrackId}
            onClick={() => selectTrack(track.id)}
            index={i}
          />
        ))}

        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-3 text-text-muted">
            <p className="text-xs font-lcd">No tracks</p>
            <Button size="sm" onClick={() => addTrack('midi')}>
              <Plus size={12} />
              Add Track
            </Button>
          </div>
        )}
      </div>

      {/* Add track buttons */}
      <div className="flex gap-1 p-2 border-t border-border-subtle">
        <Button size="sm" variant="ghost" onClick={() => addTrack('midi')} className="flex-1 font-lcd text-2xs">
          + MIDI
        </Button>
        <Button size="sm" variant="ghost" onClick={() => addTrack('audio')} className="flex-1 font-lcd text-2xs">
          + Audio
        </Button>
      </div>
    </div>
  )
}
