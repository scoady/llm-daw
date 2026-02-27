import { Music, Volume2, Mic } from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { Slider } from '@/components/common/Slider'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { VUMeter, useSimulatedLevel } from '@/components/common/VUMeter'
import type { Track } from '@/types'

const TRACK_HEIGHT = 64

interface TrackHeaderProps {
  track: Track
  selected: boolean
  onClick: () => void
  index?: number
}

export function TrackHeader({ track, selected, onClick, index }: TrackHeaderProps) {
  const { updateTrack } = useDAWStore()
  const level = useSimulatedLevel(track.muted ? 0.02 : track.volume * 0.4, 0.08)

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTrack(track.id, { muted: !track.muted })
  }

  const toggleSolo = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTrack(track.id, { solo: !track.solo })
  }

  const toggleArm = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTrack(track.id, { armed: !track.armed })
  }

  const isMidi = track.type === 'midi' || track.type === 'instrument'
  const trackNum = index !== undefined ? String(index + 1).padStart(2, '0') : ''

  return (
    <div
      onClick={onClick}
      className={clsx(
        'track-row flex items-center px-2 gap-1.5 cursor-pointer',
        'border-l-2',
        selected ? 'border-l-accent' : 'border-l-transparent'
      )}
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Track number */}
      {trackNum && (
        <span className="text-2xs font-lcd text-text-muted w-5 text-center flex-shrink-0 select-none">
          {trackNum}
        </span>
      )}

      {/* Color strip */}
      <div
        className="w-1.5 self-stretch rounded-full flex-shrink-0"
        style={{
          background: `linear-gradient(180deg, ${track.color} 0%, ${track.color}80 100%)`,
        }}
      />

      {/* Name + info + slider */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Track type badge + name */}
        <div className="flex items-center gap-1.5">
          <div className={clsx(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium',
            'bg-surface-3 border border-border-subtle'
          )}>
            {isMidi
              ? <Music size={8} className="text-neon-blue" />
              : <Volume2 size={8} className="text-vu-green" />
            }
            <span className="text-text-muted">{isMidi ? 'MIDI' : 'AUD'}</span>
          </div>
          <span className="text-xs font-medium text-text-primary truncate">{track.name}</span>
        </div>

        {/* I/O label */}
        <div className="text-2xs text-text-muted font-lcd tracking-wider">
          {isMidi ? 'MIDI IN' : 'AUDIO'}
        </div>

        {/* Volume slider + VU meter */}
        <div className="flex items-center gap-1.5">
          <Slider
            value={track.volume}
            onChange={(v) => updateTrack(track.id, { volume: v })}
            min={0}
            max={1}
            className="flex-1"
          />
          <VUMeter
            level={level}
            segments={8}
            orientation="horizontal"
            height={3}
            className="w-12"
          />
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-col gap-1 items-center">
        <button
          onClick={toggleMute}
          title="Mute"
          className={clsx(
            'hw-btn w-6 h-5',
            track.muted && 'hw-btn-mute-on'
          )}
        >
          M
        </button>

        <button
          onClick={toggleSolo}
          title="Solo"
          className={clsx(
            'hw-btn w-6 h-5',
            track.solo && 'hw-btn-solo-on'
          )}
        >
          S
        </button>

        {isMidi && (
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={toggleArm}
              title="Arm for recording"
              className={clsx(
                'hw-btn w-6 h-5',
                track.armed && 'hw-btn-arm-on'
              )}
            >
              <Mic size={8} />
            </button>
            <LEDIndicator on={track.armed} color="red" size="xs" pulse />
          </div>
        )}
      </div>
    </div>
  )
}
