import { useState, useRef, useEffect } from 'react'
import { Music, Volume2, Mic, VolumeX, Headphones } from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { Slider } from '@/components/common/Slider'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { VUMeter, useSimulatedLevel } from '@/components/common/VUMeter'
import { InstrumentSelector } from './InstrumentSelector'
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
  const isPlaying = useDAWStore((s) => s.transport.isPlaying)
  const level = useSimulatedLevel(track.muted ? 0.02 : track.volume * 0.4, 0.08)

  // ── Editable track name ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(track.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setEditName(track.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing, track.name])

  const commitName = () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== track.name) {
      updateTrack(track.id, { name: trimmed })
    }
    setEditing(false)
  }

  // ── Button handlers ──────────────────────────────────────────────────────
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
  const isActive = isPlaying && !track.muted

  return (
    <div
      onClick={onClick}
      className={clsx(
        'track-row flex items-center px-2 gap-1.5 cursor-pointer',
        'border-l-2',
        selected ? 'border-l-accent' : 'border-l-transparent',
        track.armed && 'track-row-armed'
      )}
      style={{
        height: TRACK_HEIGHT,
        boxShadow: selected ? `inset 4px 0 12px -4px ${track.color}40` : undefined,
      }}
    >
      {/* Track number */}
      {trackNum && (
        <span className="text-2xs font-lcd text-text-muted w-5 text-center flex-shrink-0 select-none">
          {trackNum}
        </span>
      )}

      {/* Color strip — wider with conditional glow */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0 transition-shadow duration-300"
        style={{
          background: `linear-gradient(180deg, ${track.color} 0%, ${track.color}80 100%)`,
          boxShadow: isActive
            ? `0 0 8px ${track.color}80, 0 0 3px ${track.color}`
            : track.armed
              ? `0 0 6px ${track.color}60`
              : 'none',
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

          {/* Editable name */}
          {editing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setEditing(false)
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-text-primary bg-surface-4 border border-accent/40 rounded px-1 py-0 w-full min-w-0 outline-none"
              style={{ boxShadow: '0 0 6px rgba(108,99,255,0.2)' }}
            />
          ) : (
            <span
              className="text-xs font-medium text-text-primary truncate cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
              title="Double-click to rename"
            >
              {track.name}
            </span>
          )}
        </div>

        {/* Instrument selector or I/O label */}
        {isMidi && track.instrument?.presetId ? (
          <InstrumentSelector trackId={track.id} presetId={track.instrument.presetId} />
        ) : (
          <div className="text-2xs text-text-muted font-lcd tracking-wider">
            {isMidi ? 'MIDI IN' : 'AUDIO'}
          </div>
        )}

        {/* Volume slider with track-colored fill + VU meter */}
        <div className="flex items-center gap-1.5">
          <Slider
            value={track.volume}
            onChange={(v) => updateTrack(track.id, { volume: v })}
            min={0}
            max={1}
            className="flex-1"
            fillColor={track.color + 'cc'}
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

      {/* Control buttons — icons instead of text */}
      <div className="flex flex-col gap-1 items-center">
        <button
          onClick={toggleMute}
          title="Mute"
          className={clsx(
            'hw-btn w-6 h-5 flex items-center justify-center',
            track.muted && 'hw-btn-mute-on'
          )}
        >
          <VolumeX size={10} />
        </button>

        <button
          onClick={toggleSolo}
          title="Solo"
          className={clsx(
            'hw-btn w-6 h-5 flex items-center justify-center',
            track.solo && 'hw-btn-solo-on'
          )}
        >
          <Headphones size={10} />
        </button>

        {isMidi && (
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={toggleArm}
              title="Arm for recording"
              className={clsx(
                'hw-btn w-6 h-5 flex items-center justify-center',
                track.armed && 'hw-btn-arm-on'
              )}
            >
              <Mic size={10} />
            </button>
            <LEDIndicator on={track.armed} color="red" size="xs" pulse />
          </div>
        )}
      </div>
    </div>
  )
}
