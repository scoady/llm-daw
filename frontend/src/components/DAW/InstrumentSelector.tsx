import { useState, useRef, useEffect } from 'react'
import { Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'
import {
  PRESETS_BY_CATEGORY,
  getPreset,
  DEFAULT_PRESET_ID,
  type PresetCategory,
} from '@/data/instrumentPresets'

interface InstrumentSelectorProps {
  trackId: string
  presetId: string
}

export function InstrumentSelector({ trackId, presetId }: InstrumentSelectorProps) {
  const { setTrackInstrument } = useDAWStore()
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('keys')
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentPreset = getPreset(presetId ?? DEFAULT_PRESET_ID)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Set active category to current preset's category when opening
  useEffect(() => {
    if (open) {
      setActiveCategory(currentPreset.category)
    }
  }, [open, currentPreset.category])

  const handleSelect = (id: string) => {
    setTrackInstrument(trackId, id)
    audioEngine.setTrackInstrument(trackId, id, 'midi')
    setOpen(false)
  }

  const handlePreview = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPreviewingId(id)
    await audioEngine.previewPreset(id)
    setTimeout(() => setPreviewingId(null), 1200)
  }

  const activeCat = PRESETS_BY_CATEGORY.find((c) => c.id === activeCategory)

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — compact button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={clsx(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs',
          'bg-surface-3 border border-border-subtle hover:border-border-default',
          'transition-colors cursor-pointer max-w-full',
          open && 'border-accent/50'
        )}
        title={currentPreset.name}
      >
        <span className="flex-shrink-0">{currentPreset.icon}</span>
        <span className="truncate text-text-secondary font-medium">
          {currentPreset.name.length > 10
            ? currentPreset.name.slice(0, 10) + '…'
            : currentPreset.name
          }
        </span>
      </button>

      {/* Floating panel */}
      {open && (
        <div
          className="fixed z-[100] rounded-lg shadow-panel-raised overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1c2030 0%, #1a1d28 100%)',
            border: '1px solid #363c52',
            width: 320,
            maxHeight: 420,
            left: containerRef.current
              ? containerRef.current.getBoundingClientRect().left
              : 0,
            top: containerRef.current
              ? containerRef.current.getBoundingClientRect().bottom + 4
              : 0,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-2xs text-text-muted uppercase tracking-[0.15em] font-lcd font-medium">
              Instrument
            </span>
            <span className="text-2xs text-accent font-lcd">
              {currentPreset.icon} {currentPreset.name}
            </span>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-border-subtle overflow-x-auto scrollbar-hide">
            {PRESETS_BY_CATEGORY.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={clsx(
                  'px-2 py-1 rounded-md text-2xs font-medium whitespace-nowrap transition-all',
                  activeCategory === cat.id
                    ? 'text-white'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-3'
                )}
                style={
                  activeCategory === cat.id
                    ? { backgroundColor: cat.color + '30', color: cat.color }
                    : undefined
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Preset list */}
          <div className="overflow-y-auto" style={{ maxHeight: 310 }}>
            {activeCat?.presets.map((preset) => {
              const isSelected = preset.id === presetId
              const isPreviewing = preset.id === previewingId

              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelect(preset.id)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-accent/10'
                      : 'hover:bg-surface-3'
                  )}
                >
                  {/* Icon */}
                  <span className="text-sm flex-shrink-0">{preset.icon}</span>

                  {/* Name */}
                  <span className={clsx(
                    'flex-1 text-xs font-medium truncate',
                    isSelected ? 'text-accent' : 'text-text-secondary'
                  )}>
                    {preset.name}
                  </span>

                  {/* Preview button */}
                  <div
                    onClick={(e) => handlePreview(e, preset.id)}
                    className={clsx(
                      'flex items-center justify-center w-6 h-6 rounded',
                      'hover:bg-surface-4 transition-colors',
                      isPreviewing && 'text-accent'
                    )}
                    title="Preview"
                  >
                    <Volume2
                      size={12}
                      className={clsx(
                        isPreviewing ? 'text-accent' : 'text-text-muted',
                        isPreviewing && 'animate-pulse'
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
