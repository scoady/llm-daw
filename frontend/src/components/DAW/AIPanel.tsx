import { useCallback, useRef, useEffect } from 'react'
import {
  Sparkles, Play, Square, Plus, Send,
  Music, Waves, ArrowRight, Loader2,
  X, Zap, Activity,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore, selectClipById } from '@/store/dawStore'
import { useAIStore } from '@/store/aiStore'
import { aiClient } from '@/services/apiClient'
import { audioEngine, createSynthFromPreset } from '@/services/audioEngine'
import { getPreset, DEFAULT_PRESET_ID } from '@/data/instrumentPresets'
import { midiToNoteName, isBlackKey } from '@/services/midiService'
import { Button } from '@/components/common/Button'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { LogoIcon } from '@/components/common/LogoIcon'
import type { Note, Suggestion } from '@/types'
import * as Tone from 'tone'

// ─── Oscilloscope Canvas ────────────────────────────────────────────────────

function Oscilloscope({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      ctx.scale(2, 2)
    }
    resize()

    let phase = 0
    const draw = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      // Background grid lines
      ctx.strokeStyle = 'rgba(108, 99, 255, 0.06)'
      ctx.lineWidth = 0.5
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      for (let x = 0; x < w; x += 8) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      // Center line
      ctx.strokeStyle = 'rgba(108, 99, 255, 0.15)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Waveform
      const speed = active ? 0.08 : 0.02
      const amplitude = active ? h * 0.35 : h * 0.12
      const freq = active ? 3 : 1.5
      const secondaryFreq = active ? 7 : 3

      phase += speed

      // Glow layer
      ctx.shadowColor = 'rgba(108, 99, 255, 0.6)'
      ctx.shadowBlur = active ? 8 : 3
      ctx.strokeStyle = active
        ? 'rgba(108, 99, 255, 0.8)'
        : 'rgba(108, 99, 255, 0.3)'
      ctx.lineWidth = active ? 2 : 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const t = x / w
        const y = h / 2
          + Math.sin(t * Math.PI * freq + phase) * amplitude * 0.7
          + Math.sin(t * Math.PI * secondaryFreq + phase * 1.3) * amplitude * 0.3
          + (active ? Math.sin(t * Math.PI * 13 + phase * 2.5) * amplitude * 0.08 : 0)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Sharp center line
      ctx.strokeStyle = active
        ? 'rgba(180, 170, 255, 0.9)'
        : 'rgba(108, 99, 255, 0.2)'
      ctx.lineWidth = active ? 1 : 0.5
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const t = x / w
        const y = h / 2
          + Math.sin(t * Math.PI * freq + phase) * amplitude * 0.7
          + Math.sin(t * Math.PI * secondaryFreq + phase * 1.3) * amplitude * 0.3
          + (active ? Math.sin(t * Math.PI * 13 + phase * 2.5) * amplitude * 0.08 : 0)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  return (
    <div className="relative overflow-hidden rounded-md" style={{ height: 60 }}>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #0a0c14 0%, #080a10 100%)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {/* Corner label */}
      <div className="absolute top-1 left-2 flex items-center gap-1.5">
        <Activity size={8} className="text-accent/50" />
        <span className="text-[9px] font-medium text-accent/40 uppercase tracking-wider">
          Signal
        </span>
      </div>
    </div>
  )
}

// ─── Mini Piano Roll Preview ────────────────────────────────────────────────

function MiniNotePreview({ notes, height = 48 }: { notes: Note[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || notes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.offsetWidth
    const h = height
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    ctx.clearRect(0, 0, w, h)

    // Subtle grid
    ctx.strokeStyle = 'rgba(108, 99, 255, 0.05)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    const pitches = notes.map((n) => n.pitch)
    const minP = Math.min(...pitches) - 2
    const maxP = Math.max(...pitches) + 2
    const range = maxP - minP
    const maxBeat = Math.max(...notes.map((n) => n.startBeat + n.durationBeats))

    for (const note of notes) {
      const x = (note.startBeat / maxBeat) * w
      const nw = Math.max(2, (note.durationBeats / maxBeat) * w - 1)
      const y = h - ((note.pitch - minP) / range) * h
      const nh = Math.max(2, (1 / range) * h)

      const alpha = 0.5 + (note.velocity / 127) * 0.5

      // Glow
      ctx.shadowColor = isBlackKey(note.pitch) ? 'rgba(108, 99, 255, 0.6)' : 'rgba(74, 144, 217, 0.6)'
      ctx.shadowBlur = 4
      ctx.fillStyle = isBlackKey(note.pitch)
        ? `rgba(108, 99, 255, ${alpha})`
        : `rgba(74, 144, 217, ${alpha})`
      ctx.beginPath()
      ctx.roundRect(x, y, nw, nh, 1)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }, [notes, height])

  if (notes.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-2xs text-text-muted rounded-md border border-border-subtle"
        style={{ height, background: 'linear-gradient(180deg, #0a0c14 0%, #080a10 100%)' }}
      >
        No notes selected
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-md border border-border-subtle"
      style={{ height, background: 'linear-gradient(180deg, #0a0c14 0%, #080a10 100%)' }}
    />
  )
}

// ─── Suggestion Card ────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  const { bpm, tracks, selectedTrackId, addTrack, addClip, addNote, setTrackInstrument } = useDAWStore()
  const { previewingSuggestionId, setPreviewingSuggestionId, targetPresetId: aiTargetPresetId } = useAIStore()
  const isPreviewing = previewingSuggestionId === suggestion.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewSynthRef = useRef<any>(null)

  // Get preset from selected track (or first MIDI track)
  const previewTrack = tracks.find((t) => t.id === selectedTrackId && (t.type === 'midi' || t.type === 'instrument'))
    ?? tracks.find((t) => t.type === 'midi' || t.type === 'instrument')
  const trackPresetId = previewTrack?.instrument?.presetId

  const typeConfig: Record<string, { color: string; glowColor: string; bgColor: string }> = {
    continuation: { color: '#39ff14', glowColor: 'rgba(57, 255, 20, 0.3)', bgColor: 'rgba(57, 255, 20, 0.08)' },
    harmony: { color: '#00d4ff', glowColor: 'rgba(0, 212, 255, 0.3)', bgColor: 'rgba(0, 212, 255, 0.08)' },
    'chord-progression': { color: '#6c63ff', glowColor: 'rgba(108, 99, 255, 0.3)', bgColor: 'rgba(108, 99, 255, 0.08)' },
    variation: { color: '#ff9f1c', glowColor: 'rgba(255, 159, 28, 0.3)', bgColor: 'rgba(255, 159, 28, 0.08)' },
  }

  const typeIcons: Record<string, typeof ArrowRight> = {
    continuation: ArrowRight,
    harmony: Waves,
    'chord-progression': Music,
    variation: Zap,
  }

  const TypeIcon = typeIcons[suggestion.type] ?? Sparkles
  const config = typeConfig[suggestion.type] ?? typeConfig.continuation

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      previewSynthRef.current?.releaseAll()
      previewSynthRef.current?.dispose()
      previewSynthRef.current = null
      setPreviewingSuggestionId(null)
      return
    }

    await audioEngine.init()
    setPreviewingSuggestionId(suggestion.id)

    // Use the selected track's instrument preset for preview
    const preset = getPreset(trackPresetId ?? DEFAULT_PRESET_ID)
    const synthAdapter = createSynthFromPreset(preset).connect(Tone.getDestination())

    // Schedule directly on audio context (not Transport) so preview works
    // regardless of transport state
    const secPerBeat = 60 / bpm
    const now = Tone.now() + 0.05
    for (const note of suggestion.notes) {
      synthAdapter.triggerAttackRelease(
        Tone.Frequency(note.pitch, 'midi').toNote(),
        note.durationBeats * secPerBeat,
        now + note.startBeat * secPerBeat,
        note.velocity / 127,
      )
    }

    const totalDuration = suggestion.durationBeats * secPerBeat
    setTimeout(() => {
      synthAdapter.dispose()
      previewSynthRef.current = null
      setPreviewingSuggestionId(null)
    }, totalDuration * 1000 + 500)
  }, [isPreviewing, suggestion, bpm, trackPresetId, setPreviewingSuggestionId])

  const handleAddToTrack = useCallback(() => {
    // Always create a new track at beat 0
    const track = addTrack('midi', suggestion.name ?? 'AI Suggestion')

    // Auto-assign instrument preset if a smart prompt targeted one
    if (aiTargetPresetId) {
      setTrackInstrument(track.id, aiTargetPresetId)
    }

    const clip = addClip(track.id, 0, suggestion.durationBeats)

    for (const note of suggestion.notes) {
      addNote(clip.id, {
        pitch: note.pitch,
        startBeat: note.startBeat,
        durationBeats: note.durationBeats,
        velocity: note.velocity,
      })
    }
  }, [addTrack, addClip, addNote, setTrackInstrument, aiTargetPresetId, suggestion])

  return (
    <div
      className="gradient-border rounded-lg overflow-hidden transition-all group"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #141824 0%, #0f1218 100%)' }}
      >
        {/* Glowing left border accent */}
        <div className="flex">
          <div
            className="w-[3px] flex-shrink-0"
            style={{
              background: `linear-gradient(180deg, ${config.color}80, ${config.color}20)`,
              boxShadow: `0 0 8px ${config.glowColor}`,
            }}
          />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50">
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider"
                style={{ color: config.color, backgroundColor: config.bgColor }}
              >
                <TypeIcon size={9} />
                {suggestion.type}
              </div>
              <span className="text-xs font-medium text-text-primary truncate flex-1">{suggestion.name}</span>
            </div>

            {/* Description */}
            <div className="px-3 py-2">
              <p className="text-2xs text-text-secondary leading-relaxed">{suggestion.description}</p>
            </div>

            {/* Mini preview */}
            <div className="px-3 pb-2">
              <MiniNotePreview notes={suggestion.notes} height={32} />
            </div>

            {/* Stats */}
            <div className="px-3 pb-2 flex items-center gap-3">
              <span className="text-[9px] text-text-muted">
                <span className="font-mono text-accent" style={{ textShadow: '0 0 4px rgba(108,99,255,0.5)' }}>
                  {suggestion.notes.length}
                </span>{' '}
                notes
              </span>
              <span className="text-[9px] text-text-muted">
                <span className="font-mono text-accent" style={{ textShadow: '0 0 4px rgba(108,99,255,0.5)' }}>
                  {suggestion.durationBeats}
                </span>{' '}
                beats
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-1 px-3 pb-3">
              <Button
                size="sm"
                variant={isPreviewing ? 'primary' : 'default'}
                onClick={handlePreview}
                className="flex-1"
              >
                {isPreviewing ? <Square size={10} /> : <Play size={10} />}
                {isPreviewing ? 'Stop' : 'Preview'}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddToTrack}
                className="flex-1"
              >
                <Plus size={10} />
                Add to Track
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Smart Instrument-Aware Prompts ──────────────────────────────────────────

interface SmartPrompt {
  label: string
  prompt: string
  targetPresetId?: string
  icon: string
  instrumentHint?: string  // sent to backend for pitch range guidance
}

const SMART_PROMPTS: SmartPrompt[] = [
  { icon: '🥁', label: 'Generate a drum beat',     prompt: 'Generate a drum beat pattern that complements this melody', targetPresetId: 'acoustic-kit', instrumentHint: 'drums' },
  { icon: '🎸', label: 'Add a bass line',          prompt: 'Add a bass line that complements this', targetPresetId: 'synth-bass', instrumentHint: 'bass' },
  { icon: '🎹', label: 'Harmonize with piano',     prompt: 'Create a piano chord accompaniment for this melody', targetPresetId: 'classic-piano', instrumentHint: 'piano' },
  { icon: '☁️', label: 'Add a pad progression',    prompt: 'Create a lush pad chord progression behind this melody', targetPresetId: 'warm-pad', instrumentHint: 'pad' },
  { icon: '⚡', label: 'Create a lead melody',     prompt: 'Create a lead melody that complements this harmony', targetPresetId: 'saw-lead', instrumentHint: 'lead' },
  { icon: '🔔', label: 'Add bell accents',         prompt: 'Add bell/chime accent notes that highlight key moments', targetPresetId: 'fm-bell', instrumentHint: 'bell' },
  { icon: '🎵', label: 'Add plucked arpeggios',    prompt: 'Create a plucked arpeggio pattern from these chords', targetPresetId: 'guitar', instrumentHint: 'plucked' },
  { icon: '→',  label: 'Continue this melody',     prompt: 'Continue this melody for 8 more bars' },
  { icon: '🎼', label: 'Create chord progression', prompt: 'Create a chord progression to go with this melody', targetPresetId: 'electric-piano', instrumentHint: 'piano' },
  { icon: '🔀', label: 'Suggest a variation',      prompt: 'Suggest a variation with a different feel' },
]

// ─── Neural Network Loading Animation ────────────────────────────────────────

function AIThinking() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    // Generate random node positions in a network pattern
    const nodes: { x: number; y: number; vx: number; vy: number; size: number }[] = []
    for (let i = 0; i < 24; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 1.5 + Math.random() * 2,
      })
    }

    let frame = 0
    const draw = () => {
      frame++
      ctx.clearRect(0, 0, w, h)

      // Update positions
      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy
        if (node.x < 0 || node.x > w) node.vx *= -1
        if (node.y < 0 || node.y > h) node.vy *= -1
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80) {
            const alpha = (1 - dist / 80) * 0.3
            const pulse = Math.sin(frame * 0.03 + i + j) * 0.5 + 0.5
            ctx.strokeStyle = `rgba(108, 99, 255, ${alpha * (0.5 + pulse * 0.5)})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const pulse = Math.sin(frame * 0.05 + i * 0.7) * 0.5 + 0.5
        const alpha = 0.3 + pulse * 0.7

        // Glow
        ctx.shadowColor = `rgba(108, 99, 255, ${alpha * 0.8})`
        ctx.shadowBlur = 6
        ctx.fillStyle = `rgba(108, 99, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(nodes[i].x, nodes[i].y, nodes[i].size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-6 gap-3">
      <div className="relative w-full overflow-hidden rounded-md" style={{ height: 80 }}>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, #0a0c14 0%, #080a10 100%)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      <div className="flex items-center gap-2">
        <LEDIndicator on color="accent" size="xs" pulse />
        <span className="text-[10px] font-medium text-accent uppercase tracking-wider animate-pulse"
          style={{ textShadow: '0 0 6px rgba(108,99,255,0.5)' }}
        >
          Analyzing
        </span>
      </div>
    </div>
  )
}

// ─── Main AI Panel ──────────────────────────────────────────────────────────

export function AIPanel() {
  const {
    tracks,
    selectedClipId,
    bpm,
  } = useDAWStore()

  const {
    prompt,
    setPrompt,
    isGenerating,
    setGenerating,
    error,
    setError,
    analysis,
    setAnalysis,
    suggestions,
    setSuggestions,
    clearResults,
    setTargetPresetId,
  } = useAIStore()

  // Track the instrument hint for the current prompt
  const instrumentHintRef = useRef<string | undefined>(undefined)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get the selected clip's notes
  const selectedClip = selectedClipId
    ? selectClipById(selectedClipId)(useDAWStore.getState())
    : undefined
  const clipNotes = selectedClip?.notes ?? []

  // If no clip selected, try to find any clip with notes
  const allNotes = clipNotes.length > 0
    ? clipNotes
    : tracks.flatMap((t) => t.clips.flatMap((c) => c.notes ?? []))

  const handleAnalyze = useCallback(async () => {
    if (allNotes.length === 0) {
      setError('Record or select some MIDI notes first')
      return
    }

    setGenerating(true)
    setError(null)
    clearResults()

    try {
      const result = await aiClient.analyze(
        allNotes.map((n) => ({
          id: n.id,
          pitch: n.pitch,
          startBeat: n.startBeat,
          durationBeats: n.durationBeats,
          velocity: n.velocity,
        })),
        bpm,
        prompt || 'Analyze these notes and suggest harmonies, continuations, and variations.',
        instrumentHintRef.current,
      )
      setAnalysis(result.analysis)
      setSuggestions(result.suggestions)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }, [allNotes, bpm, prompt, setGenerating, setError, clearResults, setAnalysis, setSuggestions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAnalyze()
    }
  }

  return (
    <div
      className="flex flex-col h-full w-[380px] ai-panel scan-line-overlay noise-texture"
      style={{ background: 'linear-gradient(180deg, #0e1018 0%, #0a0c12 50%, #080a0e 100%)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle"
        style={{ background: 'linear-gradient(180deg, #12151e 0%, #0d1018 100%)' }}
      >
        <LEDIndicator on color="accent" size="xs" pulse />
        <LogoIcon size={16} color="#6c63ff" glow glowColor="rgba(108,99,255,0.5)" />
        <h2 className="text-xs font-semibold text-accent uppercase tracking-[0.12em] flex-1"
          style={{ textShadow: '0 0 8px rgba(108,99,255,0.4)' }}
        >
          AI Assist
        </h2>
        <button
          onClick={() => useDAWStore.getState().setAIPanelOpen(false)}
          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-3"
        >
          <X size={12} />
        </button>
      </div>

      {/* Oscilloscope */}
      <div className="px-3 pt-3">
        <Oscilloscope active={isGenerating} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Input Section */}
        <div className="p-4 space-y-3 border-b border-border-subtle/50">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-text-muted uppercase tracking-[0.12em] font-medium">
              Input
            </span>
            <span className="text-[9px] text-text-muted">
              <span className="font-mono text-accent">{allNotes.length}</span> notes{' '}
              {selectedClipId ? '(clip)' : '(all)'}
            </span>
          </div>
          <MiniNotePreview notes={allNotes} height={56} />

          {allNotes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...new Set(allNotes.map((n) => midiToNoteName(n.pitch)))].slice(0, 12).map((name) => (
                <span
                  key={name}
                  className="text-[9px] px-1.5 py-0.5 rounded font-mono text-accent/80"
                  style={{
                    background: 'rgba(108, 99, 255, 0.08)',
                    border: '1px solid rgba(108, 99, 255, 0.15)',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Section */}
        <div className="p-4 space-y-3 border-b border-border-subtle/50">
          <span className="text-[9px] text-text-muted uppercase tracking-[0.12em] font-medium">
            Prompt
          </span>

          <div className="relative group">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should AI do with these notes?"
              rows={3}
              className="w-full rounded-md px-3 py-2 text-xs text-text-primary
                         placeholder:text-text-muted/50 resize-none
                         focus:outline-none transition-all"
              style={{
                background: 'linear-gradient(180deg, #0a0c14 0%, #080a10 100%)',
                border: '1px solid rgba(45, 51, 72, 0.5)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.4)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.4), 0 0 8px rgba(108, 99, 255, 0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(45, 51, 72, 0.5)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.4)'
              }}
            />
            <button
              onClick={handleAnalyze}
              disabled={isGenerating || allNotes.length === 0}
              className={clsx(
                'absolute bottom-2 right-2 p-1.5 rounded transition-all',
                isGenerating || allNotes.length === 0
                  ? 'text-text-muted cursor-not-allowed'
                  : 'text-accent hover:bg-accent/10 cursor-pointer'
              )}
              style={!(isGenerating || allNotes.length === 0) ? {
                filter: 'drop-shadow(0 0 4px rgba(108,99,255,0.4))',
              } : undefined}
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* Smart prompts */}
          <div className="flex flex-wrap gap-1.5">
            {SMART_PROMPTS.map((sp, i) => (
              <button
                key={sp.label}
                onClick={() => {
                  setPrompt(sp.prompt)
                  setTargetPresetId(sp.targetPresetId ?? null)
                  instrumentHintRef.current = sp.instrumentHint
                  textareaRef.current?.focus()
                }}
                className="text-[9px] px-2 py-1 rounded text-text-muted transition-all
                           hover:text-accent hover:border-accent/30"
                style={{
                  background: 'rgba(108, 99, 255, 0.04)',
                  border: '1px solid rgba(45, 51, 72, 0.3)',
                  animationDelay: `${i * 50}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(108, 99, 255, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.3)'
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(108, 99, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(108, 99, 255, 0.04)'
                  e.currentTarget.style.borderColor = 'rgba(45, 51, 72, 0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span className="mr-1">{sp.icon}</span>
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="px-4">
            <AIThinking />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mx-4 mt-4 flex items-start gap-2 px-3 py-2 rounded-md"
            style={{
              background: 'rgba(255, 46, 99, 0.08)',
              border: '1px solid rgba(255, 46, 99, 0.2)',
              boxShadow: 'inset 0 0 12px rgba(255, 46, 99, 0.05)',
            }}
          >
            <LEDIndicator on color="red" size="xs" />
            <p className="text-xs text-neon-red">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !isGenerating && (
          <div className="p-4 space-y-3 border-b border-border-subtle/50">
            <div className="flex items-center gap-2">
              <LEDIndicator on color="green" size="xs" />
              <span className="text-[9px] text-text-muted uppercase tracking-[0.12em] font-medium">
                Analysis Complete
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-md px-3 py-2"
                style={{
                  background: 'linear-gradient(180deg, #0e1018 0%, #0a0c14 100%)',
                  border: '1px solid rgba(45, 51, 72, 0.4)',
                  borderLeft: '3px solid rgba(0, 212, 255, 0.6)',
                  boxShadow: 'inset 0 0 12px rgba(0, 212, 255, 0.03)',
                }}
              >
                <span className="text-[9px] text-text-muted uppercase tracking-wider block">Key</span>
                <span className="text-sm font-bold font-mono text-cyan"
                  style={{ textShadow: '0 0 8px rgba(0, 212, 255, 0.4)' }}
                >
                  {analysis.key} {analysis.scale}
                </span>
              </div>
              <div
                className="rounded-md px-3 py-2"
                style={{
                  background: 'linear-gradient(180deg, #0e1018 0%, #0a0c14 100%)',
                  border: '1px solid rgba(45, 51, 72, 0.4)',
                  borderLeft: '3px solid rgba(108, 99, 255, 0.6)',
                  boxShadow: 'inset 0 0 12px rgba(108, 99, 255, 0.03)',
                }}
              >
                <span className="text-[9px] text-text-muted uppercase tracking-wider block">Tempo</span>
                <span className="text-sm font-bold font-mono text-accent"
                  style={{ textShadow: '0 0 8px rgba(108, 99, 255, 0.4)' }}
                >
                  {analysis.tempo} BPM
                </span>
              </div>
            </div>

            <p className="text-2xs text-text-secondary leading-relaxed">{analysis.pattern}</p>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !isGenerating && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LEDIndicator on color="cyan" size="xs" />
                <span className="text-[9px] text-text-muted uppercase tracking-[0.12em] font-medium">
                  Suggestions
                </span>
              </div>
              <span className="text-[9px] font-mono text-accent">
                {suggestions.length}
              </span>
            </div>

            <div className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !analysis && !error && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(180deg, rgba(108,99,255,0.12) 0%, rgba(108,99,255,0.04) 100%)',
                border: '1px solid rgba(108, 99, 255, 0.15)',
                boxShadow: '0 0 20px rgba(108, 99, 255, 0.08)',
              }}
            >
              <LogoIcon size={28} color="#6c63ff" glow />
            </div>
            <h3
              className="text-sm font-semibold text-accent mb-2 uppercase tracking-wide"
              style={{ textShadow: '0 0 8px rgba(108,99,255,0.3)' }}
            >
              AI Assist
            </h3>
            <p className="text-[10px] text-text-muted leading-relaxed max-w-[240px]">
              Play some notes on your MIDI keyboard, then ask AI to analyze, harmonize,
              or continue your melody.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
