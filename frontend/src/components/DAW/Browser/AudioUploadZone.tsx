import { useState, useCallback, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface AudioUploadZoneProps {
  isUploading: boolean
  onUpload: (file: File) => void
}

const ACCEPTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/x-wav']

export function AudioUploadZone({ isUploading, onUpload }: AudioUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (ACCEPTED_TYPES.includes(file.type) || file.name.match(/\.(wav|mp3|ogg)$/i))) {
      onUpload(file)
    }
  }, [onUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [onUpload])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        'mx-2 mt-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all',
        'flex flex-col items-center justify-center gap-2',
        dragOver
          ? 'border-cyan/60 bg-cyan/5'
          : 'border-border-subtle/40 hover:border-border-default/60 bg-surface-2/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,.ogg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading ? (
        <>
          <Loader2 size={20} className="text-cyan animate-spin" />
          <span className="text-2xs font-lcd text-cyan">Uploading...</span>
        </>
      ) : (
        <>
          <Upload size={20} className={clsx('transition-colors', dragOver ? 'text-cyan' : 'text-text-muted/60')} />
          <span className="text-2xs font-lcd text-text-muted text-center">
            Drop WAV, MP3, or OGG
            <br />
            <span className="text-text-muted/50">or click to browse</span>
          </span>
        </>
      )}
    </div>
  )
}
