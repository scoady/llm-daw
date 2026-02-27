import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMIDIInput } from '@/hooks/useMIDIInput'
import { Transport } from '@/components/DAW/Transport'
import { TrackPanel } from '@/components/DAW/TrackPanel'
import { ArrangementView } from '@/components/DAW/ArrangementView'
import { BottomPanel } from '@/components/DAW/BottomPanel'
import { AIPanel } from '@/components/DAW/AIPanel'
import { LEDIndicator } from '@/components/common/LEDIndicator'

// ─── Status Bar ──────────────────────────────────────────────────────────────

function StatusBar() {
  const { projectName, tracks, saveStatus } = useDAWStore()
  const [cpuLoad] = useState(() => (Math.random() * 8 + 2).toFixed(1))

  return (
    <div
      className="flex items-center justify-between px-4 h-[22px] border-t border-border-subtle/50 select-none"
      style={{
        background: 'linear-gradient(180deg, #0d1018 0%, #0a0c12 100%)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <LEDIndicator on color="green" size="xs" />
          <span className="text-[9px] font-lcd text-text-muted truncate max-w-[140px]">
            {projectName || 'Untitled'}
          </span>
        </div>
        <span className="text-[9px] font-lcd text-text-muted/40">|</span>
        <span className="text-[9px] font-lcd text-text-muted">
          <span className="text-accent/60">{tracks.length}</span> tracks
        </span>
        <span className="text-[9px] font-lcd text-text-muted/40">|</span>
        <span className={clsx(
          'text-[9px] font-lcd',
          saveStatus === 'saving' && 'text-amber',
          saveStatus === 'saved' && 'text-neon-green/60',
          saveStatus === 'error' && 'text-neon-red/60',
          saveStatus === 'idle' && 'text-text-muted/40',
        )}>
          {saveStatus === 'saving' ? 'Saving...'
            : saveStatus === 'saved' ? 'Saved'
            : saveStatus === 'error' ? 'Save error'
            : ''}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[9px] font-lcd text-text-muted">
          <span className="text-cyan/60">48kHz</span> / <span className="text-cyan/60">256</span> samples
        </span>
        <span className="text-[9px] font-lcd text-text-muted/40">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-lcd text-text-muted">CPU</span>
          <div className="w-[30px] h-[4px] rounded-full overflow-hidden" style={{ background: '#1a1d2a' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${parseFloat(cpuLoad) * 5}%`,
                background: parseFloat(cpuLoad) > 15
                  ? '#ff2e63'
                  : parseFloat(cpuLoad) > 8
                    ? '#ff9f1c'
                    : '#39ff14',
                boxShadow: `0 0 4px ${parseFloat(cpuLoad) > 15 ? 'rgba(255,46,99,0.4)' : parseFloat(cpuLoad) > 8 ? 'rgba(255,159,28,0.4)' : 'rgba(57,255,20,0.4)'}`,
              }}
            />
          </div>
          <span className="text-[9px] font-lcd text-text-muted tabular-nums w-[28px] text-right">
            {cpuLoad}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Resize Grip ─────────────────────────────────────────────────────────────

function ResizeGrip({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false)
  const lastY = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastY.current = e.clientY
    e.preventDefault()

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientY - lastY.current
      lastY.current = e.clientY
      onResize(delta)
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize])

  return (
    <div
      className="h-[5px] cursor-row-resize flex items-center justify-center group"
      style={{
        background: 'linear-gradient(180deg, #0d1018 0%, #12151e 50%, #0d1018 100%)',
        borderTop: '1px solid rgba(45, 51, 72, 0.3)',
        borderBottom: '1px solid rgba(45, 51, 72, 0.3)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Grip dots */}
      <div className="flex gap-1 opacity-30 group-hover:opacity-60 transition-opacity">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[3px] h-[3px] rounded-full bg-text-muted" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Project Page ───────────────────────────────────────────────────────

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setProjectId, setProjectName, addTrack, tracks, aiPanelOpen, loadProject, createProject } = useDAWStore()
  const [mixerHeight, setMixerHeight] = useState(320)

  useAudioEngine()
  useKeyboardShortcuts()
  useMIDIInput()

  // Initialize a new project or load an existing one
  useEffect(() => {
    if (id === 'new' || !id) {
      // Create a new project in the database
      createProject('Untitled Project', 120).then((newId) => {
        navigate(`/project/${newId}`, { replace: true })
      }).catch(() => {
        // Fallback: work in memory if API is unavailable
        setProjectId('new')
        setProjectName('Untitled Project')
        if (tracks.length === 0) {
          addTrack('midi', 'MIDI Track 1')
        }
      })
    } else {
      loadProject(id).then(() => {
        // If project loaded with no tracks, add a default
        const state = useDAWStore.getState()
        if (state.tracks.length === 0) {
          addTrack('midi', 'MIDI Track 1')
        }
      })
    }
  }, [id])

  const handleMixerResize = useCallback((delta: number) => {
    setMixerHeight((prev) => Math.max(160, Math.min(500, prev - delta)))
  }, [])

  return (
    <div className="h-full flex flex-col bg-surface-0 overflow-hidden">
      {/* Transport bar */}
      <Transport />

      {/* Main workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Track panel + arrangement */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <TrackPanel />
          <ArrangementView />
        </div>

        {/* AI Panel (slide-in from right) */}
        <div
          className={clsx(
            'overflow-hidden border-l border-border-subtle/50 transition-all duration-300 ease-in-out',
            aiPanelOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0'
          )}
          style={aiPanelOpen ? {
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.3), -1px 0 0 rgba(108, 99, 255, 0.05)',
          } : undefined}
        >
          {aiPanelOpen && <AIPanel />}
        </div>
      </div>

      {/* Resize grip */}
      <ResizeGrip onResize={handleMixerResize} />

      {/* Bottom panel (tabbed: MIXER | EDITOR | MASTER) */}
      <div style={{ height: mixerHeight }}>
        <BottomPanel />
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}
