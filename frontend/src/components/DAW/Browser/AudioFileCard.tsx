import { Play, Plus, FileAudio } from 'lucide-react'
import { clsx } from 'clsx'
import type { AudioFileInfo } from '@/types'

interface AudioFileCardProps {
  file: AudioFileInfo
  isPreviewing: boolean
  onPreview: (file: AudioFileInfo) => void
  onInsert: (file: AudioFileInfo) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AudioFileCard({ file, isPreviewing, onPreview, onInsert }: AudioFileCardProps) {
  return (
    <div className="group flex items-center gap-2 px-2 py-2 border-b border-border-subtle/30 hover:bg-surface-3/50 transition-colors">
      {/* Icon */}
      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-cyan/10">
        <FileAudio size={14} className="text-cyan/60" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-text-secondary truncate block">
          {file.filename}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs font-lcd text-text-muted">
            {formatSize(file.sizeBytes)}
          </span>
          {file.durationSecs != null && (
            <>
              <span className="text-2xs font-lcd text-text-muted/40">|</span>
              <span className="text-2xs font-lcd text-text-muted">
                {file.durationSecs.toFixed(1)}s
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onPreview(file)}
          className={clsx(
            'p-1 rounded hover:bg-surface-4 transition-colors',
            isPreviewing ? 'text-cyan' : 'text-text-muted'
          )}
          title="Preview"
        >
          <Play size={12} className={isPreviewing ? 'animate-pulse' : ''} />
        </button>
        <button
          onClick={() => onInsert(file)}
          className="p-1 rounded hover:bg-cyan/20 text-text-muted hover:text-cyan transition-colors"
          title="Insert into track"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
