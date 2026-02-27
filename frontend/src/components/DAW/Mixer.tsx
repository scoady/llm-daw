import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import { useEffect } from 'react'
import { Knob } from '@/components/common/Knob'
import { Slider } from '@/components/common/Slider'
import { VUMeter, useSimulatedLevel } from '@/components/common/VUMeter'
import { LEDIndicator } from '@/components/common/LEDIndicator'

function ChannelStrip({ trackId }: { trackId: string }) {
  const { tracks, updateTrack, selectedTrackId, selectTrack } = useDAWStore()
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return null

  const isSelected = track.id === selectedTrackId
  const dbValue = Math.round(20 * Math.log10(Math.max(track.volume, 0.001)))
  const level = useSimulatedLevel(track.muted ? 0.02 : track.volume * 0.5, 0.12)
  const isMidi = track.type === 'midi' || track.type === 'instrument'

  // Sync to audio engine
  useEffect(() => {
    audioEngine.setTrackVolume(track.id, track.volume)
  }, [track.volume, track.id])

  useEffect(() => {
    audioEngine.setTrackPan(track.id, track.pan)
  }, [track.pan, track.id])

  useEffect(() => {
    audioEngine.setTrackMute(track.id, track.muted)
  }, [track.muted, track.id])

  return (
    <div
      onClick={() => selectTrack(track.id)}
      className={clsx(
        'channel-strip flex flex-col items-center gap-1 px-1.5 py-1.5 cursor-pointer',
        isSelected && 'selected'
      )}
      style={{ width: 72 }}
    >
      {/* Track color bar */}
      <div className="w-full h-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />

      {/* Track name */}
      <span
        className="text-2xs text-text-secondary truncate w-full text-center font-medium"
        title={track.name}
      >
        {track.name}
      </span>

      {/* Pan knob */}
      <Knob
        value={track.pan}
        onChange={(v) => updateTrack(track.id, { pan: v })}
        min={-1}
        max={1}
        size="sm"
        label="PAN"
        bipolar
        color="#00d4ff"
      />

      {/* Send knobs (visual placeholders) */}
      <div className="flex items-center gap-1">
        <Knob value={0} onChange={() => {}} min={0} max={1} size="sm" label="S1" color="#4a5068" />
        <Knob value={0} onChange={() => {}} min={0} max={1} size="sm" label="S2" color="#4a5068" />
      </div>

      {/* VU Meter + Fader */}
      <div className="flex items-stretch gap-1 flex-1 w-full" style={{ height: 110 }}>
        <VUMeter level={level} segments={14} height={110} width={4} />
        <div className="flex-1">
          <Slider
            value={track.volume}
            onChange={(v) => updateTrack(track.id, { volume: v })}
            min={0}
            max={1}
            vertical
            fillColor="rgba(108, 99, 255, 0.5)"
          />
        </div>
      </div>

      {/* dB readout */}
      <span className="text-2xs font-lcd text-text-muted tabular-nums">
        {dbValue > -60 ? `${dbValue}dB` : '-inf'}
      </span>

      {/* Solo / Mute / Arm */}
      <div className="flex items-center gap-1">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }) }}
            className={clsx('hw-btn w-6 h-5', track.muted && 'hw-btn-mute-on')}
          >
            M
          </button>
          <LEDIndicator on={track.muted} color="amber" size="xs" />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }) }}
            className={clsx('hw-btn w-6 h-5', track.solo && 'hw-btn-solo-on')}
          >
            S
          </button>
          <LEDIndicator on={track.solo} color="amber" size="xs" />
        </div>

        {isMidi && (
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }) }}
              className={clsx('hw-btn w-6 h-5', track.armed && 'hw-btn-arm-on')}
            >
              R
            </button>
            <LEDIndicator on={track.armed} color="red" size="xs" pulse />
          </div>
        )}
      </div>

      {/* Output routing */}
      <span className="text-2xs text-text-muted font-lcd tracking-wider">Master</span>
    </div>
  )
}

// Master channel strip
function MasterStrip() {
  const levelL = useSimulatedLevel(0.45, 0.15)
  const levelR = useSimulatedLevel(0.42, 0.14)

  return (
    <div
      className="flex flex-col items-center gap-1 px-2 py-1.5 border-r-2 border-border-strong"
      style={{
        width: 88,
        background: 'linear-gradient(180deg, #12151e 0%, #0d1018 100%)',
      }}
    >
      {/* Label */}
      <span className="text-2xs text-text-muted uppercase font-lcd tracking-[0.15em] font-medium">Master</span>

      {/* Master pan */}
      <Knob value={0} onChange={() => {}} min={-1} max={1} size="sm" label="PAN" bipolar color="#00d4ff" />

      {/* Stereo VU + Fader */}
      <div className="flex items-stretch gap-1 flex-1 w-full" style={{ height: 140 }}>
        <VUMeter level={levelL} segments={18} height={140} width={4} />
        <VUMeter level={levelR} segments={18} height={140} width={4} />
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
      <span className="text-2xs font-lcd text-text-lcd text-glow-green">-1dB</span>

      {/* Spacer for alignment */}
      <div className="h-[22px]" />
    </div>
  )
}

export function Mixer() {
  const { tracks } = useDAWStore()

  return (
    <div className="flex flex-col h-full">
      {/* Channel strips */}
      <div className="flex flex-1 overflow-x-auto">
        <MasterStrip />
        {tracks.map((t) => (
          <ChannelStrip key={t.id} trackId={t.id} />
        ))}
      </div>
    </div>
  )
}
