import { useState } from 'react'
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

export function InstrumentBrowser() {
  const { selectedTrackId, tracks, setTrackInstrument } = useDAWStore()
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('keys')
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId)
  const currentPresetId = selectedTrack?.instrument?.presetId ?? DEFAULT_PRESET_ID

  const activeCat = PRESETS_BY_CATEGORY.find((c) => c.id === activeCategory)

  const handleSelect = (id: string) => {
    if (!selectedTrackId) return
    setTrackInstrument(selectedTrackId, id)
    audioEngine.setTrackInstrument(selectedTrackId, id, 'midi')
  }

  const handlePreview = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPreviewingId(id)
    await audioEngine.previewPreset(id)
    setTimeout(() => setPreviewingId(null), 1200)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Current preset */}
      <div className="px-3 py-2 border-b border-border-subtle/30">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-text-muted font-lcd uppercase tracking-wider">
            {selectedTrack ? selectedTrack.name : 'No track selected'}
          </span>
          <span className="text-2xs text-cyan font-lcd">
            {getPreset(currentPresetId).icon} {getPreset(currentPresetId).name}
          </span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border-subtle/30">
        {PRESETS_BY_CATEGORY.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={clsx(
              'px-2 py-0.5 rounded-full text-2xs font-medium whitespace-nowrap transition-all',
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
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeCat?.presets.map((preset) => {
          const isSelected = preset.id === currentPresetId
          const isPreviewing = preset.id === previewingId

          return (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                isSelected
                  ? 'bg-cyan/10'
                  : 'hover:bg-surface-3'
              )}
            >
              <span className="text-sm flex-shrink-0">{preset.icon}</span>
              <span className={clsx(
                'flex-1 text-xs font-medium truncate',
                isSelected ? 'text-cyan' : 'text-text-secondary'
              )}>
                {preset.name}
              </span>
              <div
                onClick={(e) => handlePreview(e, preset.id)}
                className={clsx(
                  'flex items-center justify-center w-6 h-6 rounded',
                  'hover:bg-surface-4 transition-colors',
                  isPreviewing && 'text-cyan'
                )}
                title="Preview"
              >
                <Volume2
                  size={12}
                  className={clsx(
                    isPreviewing ? 'text-cyan' : 'text-text-muted',
                    isPreviewing && 'animate-pulse'
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
