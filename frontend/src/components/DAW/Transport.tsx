import { useCallback, useState, useRef, useEffect } from 'react'
import {
  Play, Pause, Square, Circle,
  SkipBack, Repeat,
  ZoomIn, ZoomOut, Sparkles, FolderOpen,
  ChevronUp, ChevronDown, Grid3x3,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { MIDIStatus } from './MIDIStatus'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { VUMeter, useSimulatedLevel } from '@/components/common/VUMeter'
import { useLibraryStore } from '@/store/libraryStore'

function BeatDisplay({ beat }: { beat: number }) {
  const bar = Math.floor(beat / 4) + 1
  const b = Math.floor(beat % 4) + 1
  const sixteenth = Math.floor((beat * 4) % 4) + 1

  const display = `${String(bar).padStart(3, ' ')}:${b}:${sixteenth}`
  const dim = '888:8:8'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="lcd-display text-sm min-w-[110px] text-center select-none">
        <div className="lcd-dim text-sm">{dim}</div>
        <div className="lcd-bright text-sm">{display}</div>
      </div>
      <span className="text-2xs text-text-muted font-lcd tracking-wider">BAR:BEAT:16</span>
    </div>
  )
}

function BpmControl() {
  const { bpm, setBpm } = useDAWStore()

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <div className="lcd-display text-sm min-w-[60px] text-center select-none px-2 py-1">
          <div className="lcd-dim text-sm">888</div>
          <div className="lcd-bright text-sm">{bpm}</div>
        </div>
        <div className="flex flex-col gap-0">
          <button
            onClick={() => setBpm(Math.min(300, bpm + 1))}
            className="text-text-muted hover:text-text-primary transition-colors p-0.5"
          >
            <ChevronUp size={10} />
          </button>
          <button
            onClick={() => setBpm(Math.max(20, bpm - 1))}
            className="text-text-muted hover:text-text-primary transition-colors p-0.5"
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>
      <span className="text-2xs text-text-muted font-lcd tracking-wider">BPM</span>
    </div>
  )
}

function TimeSigDisplay() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="px-2 py-1 rounded border border-border-subtle bg-surface-2 text-xs font-lcd text-text-secondary select-none">
        4/4
      </div>
      <span className="text-2xs text-text-muted font-lcd tracking-wider">SIG</span>
    </div>
  )
}

function AudioStatus() {
  return (
    <div className="flex items-center gap-3 text-2xs font-lcd text-text-muted select-none">
      <span>48kHz</span>
      <span className="text-text-muted/50">|</span>
      <span>256</span>
    </div>
  )
}

export function Transport() {
  const {
    transport, tracks, selectedTrackId, quantizeGrid,
    zoomIn, zoomOut, startRecording, stopRecording,
    toggleAIPanel, aiPanelOpen, quantizeClip, setQuantizeGrid,
  } = useDAWStore()
  const { play, pause, stop } = useAudioEngine()
  const { sidebarOpen, toggleSidebar } = useLibraryStore()
  const masterLevel = useSimulatedLevel(transport.isPlaying ? 0.5 : 0.08, transport.isPlaying ? 0.2 : 0.04)

  const [quantizeOpen, setQuantizeOpen] = useState(false)
  const quantizeRef = useRef<HTMLDivElement>(null)

  // Close quantize dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (quantizeRef.current && !quantizeRef.current.contains(e.target as Node)) {
        setQuantizeOpen(false)
      }
    }
    if (quantizeOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [quantizeOpen])

  const gridLabel = quantizeGrid === 1 ? '1/4' : quantizeGrid === 0.5 ? '1/8' : '1/16'

  const handleQuantize = useCallback(() => {
    // Quantize all clips on the selected or armed track
    const target = tracks.find((t) => t.id === selectedTrackId)
      ?? tracks.find((t) => t.armed)
    if (!target) return
    for (const clip of target.clips) {
      if (clip.notes?.length) {
        quantizeClip(clip.id, quantizeGrid)
      }
    }
  }, [tracks, selectedTrackId, quantizeGrid, quantizeClip])

  const togglePlay = useCallback(() => {
    if (transport.isPlaying) pause()
    else play()
  }, [transport.isPlaying, play, pause])

  const toggleRecord = useCallback(() => {
    if (transport.isRecording) {
      stopRecording()
      // Stop transport and seek to start so user can immediately replay
      stop()
    } else {
      startRecording()
      if (!transport.isPlaying) play()
    }
  }, [transport.isRecording, transport.isPlaying, startRecording, stopRecording, play, stop])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 select-none transport-bar scan-line-overlay">
      {/* Logo + power LED */}
      <div className="flex items-center gap-2 mr-1">
        <LEDIndicator on color="accent" size="xs" />
        <span className="text-sm font-bold font-lcd text-gradient-accent tracking-tight">
          LLM-DAW
        </span>
      </div>

      {/* Hardware groove */}
      <div className="hardware-groove" />

      {/* Browser toggle */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={toggleSidebar}
          title="Browser (B)"
          className={clsx('transport-btn', sidebarOpen && 'active')}
        >
          <FolderOpen size={12} />
        </button>
        <LEDIndicator on={sidebarOpen} color="cyan" size="xs" />
      </div>

      <div className="hardware-groove" />

      {/* Transport button group */}
      <div className="btn-group flex items-center gap-1">
        <button onClick={stop} title="Stop (Esc)" className="transport-btn">
          <Square size={12} />
        </button>

        <button onClick={stop} title="Return to start" className="transport-btn">
          <SkipBack size={12} />
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={togglePlay}
            title="Play/Pause (Space)"
            className={clsx('transport-btn', transport.isPlaying && 'active transport-btn-play')}
          >
            {transport.isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <LEDIndicator on={transport.isPlaying} color="green" size="xs" />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={toggleRecord}
            title="Record (R)"
            className={clsx('transport-btn', transport.isRecording && 'transport-btn-record')}
          >
            <Circle size={12} className={transport.isRecording ? 'fill-current' : ''} />
          </button>
          <LEDIndicator on={transport.isRecording} color="red" size="xs" pulse />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <button title="Loop" className={clsx('transport-btn', transport.loopEnabled && 'active')}>
            <Repeat size={12} />
          </button>
          <LEDIndicator on={transport.loopEnabled} color="cyan" size="xs" />
        </div>
      </div>

      {/* Hardware groove */}
      <div className="hardware-groove" />

      {/* MIDI Status */}
      <MIDIStatus />

      <div className="hardware-groove" />

      {/* Quantize */}
      <div ref={quantizeRef} className="relative flex items-center gap-1">
        <button
          onClick={handleQuantize}
          title={`Quantize selected track (${gridLabel})`}
          className="transport-btn"
        >
          <Grid3x3 size={12} />
        </button>
        <button
          onClick={() => setQuantizeOpen(!quantizeOpen)}
          className={clsx(
            'px-1.5 py-1 rounded text-2xs font-lcd text-text-muted',
            'border border-border-subtle hover:border-border-default transition-colors',
            quantizeOpen && 'border-accent/50 text-accent'
          )}
        >
          {gridLabel}
        </button>
        {quantizeOpen && (
          <div
            className="absolute top-full left-0 mt-1 rounded-lg shadow-panel-raised z-50 overflow-hidden py-1"
            style={{ background: 'linear-gradient(180deg, #111420 0%, #0f1114 100%)', border: '1px solid #2d3348' }}
          >
            {([
              { label: '1/4', value: 1 },
              { label: '1/8', value: 0.5 },
              { label: '1/16', value: 0.25 },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                onClick={() => { setQuantizeGrid(opt.value); setQuantizeOpen(false) }}
                className={clsx(
                  'w-full px-4 py-1.5 text-left text-xs font-lcd transition-colors',
                  quantizeGrid === opt.value
                    ? 'text-accent bg-accent/10'
                    : 'text-text-secondary hover:bg-surface-3'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hardware-groove" />

      {/* Beat display */}
      <BeatDisplay beat={transport.currentBeat} />

      {/* Master VU */}
      <div className="flex items-center gap-[2px] h-[44px]">
        <VUMeter level={masterLevel} segments={16} height={44} width={3} />
        <VUMeter level={masterLevel * 0.92} segments={16} height={44} width={3} />
      </div>

      {/* BPM */}
      <BpmControl />

      {/* Time Signature */}
      <TimeSigDisplay />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Audio status */}
      <AudioStatus />

      <div className="hardware-groove" />

      {/* AI Panel toggle */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={toggleAIPanel}
          title="AI Panel (A)"
          className={clsx('transport-btn', aiPanelOpen && 'active')}
        >
          <Sparkles size={12} />
        </button>
        <LEDIndicator on={aiPanelOpen} color="accent" size="xs" />
      </div>

      <div className="hardware-groove" />

      {/* Zoom */}
      <div className="btn-group flex items-center gap-1">
        <button onClick={zoomOut} title="Zoom out (Ctrl+-)" className="transport-btn">
          <ZoomOut size={12} />
        </button>
        <button onClick={zoomIn} title="Zoom in (Ctrl++)" className="transport-btn">
          <ZoomIn size={12} />
        </button>
      </div>
    </div>
  )
}
