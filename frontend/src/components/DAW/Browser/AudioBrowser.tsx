import { useState, useCallback, useEffect } from 'react'
import { Headphones } from 'lucide-react'
import { useLibraryStore } from '@/store/libraryStore'
import { useDAWStore } from '@/store/dawStore'
import { audioFileUrl } from '@/services/apiClient'
import { audioEngine } from '@/services/audioEngine'
import { AudioUploadZone } from './AudioUploadZone'
import { AudioFileCard } from './AudioFileCard'
import type { AudioFileInfo } from '@/types'

export function AudioBrowser() {
  const { audioFiles, isUploading, uploadAudioFile, fetchAudioFiles } = useLibraryStore()
  const { addTrack, selectTrack, bpm } = useDAWStore()
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  // Load audio files from DB on mount
  useEffect(() => {
    fetchAudioFiles()
  }, [fetchAudioFiles])

  const handleUpload = useCallback((file: File) => {
    uploadAudioFile(file)
  }, [uploadAudioFile])

  const handlePreview = useCallback(async (file: AudioFileInfo) => {
    setPreviewingId(file.id)
    const url = audioFileUrl(file.id)
    await audioEngine.previewAudioFile(url)
    setTimeout(() => setPreviewingId(null), 3000)
  }, [])

  const handleInsert = useCallback((file: AudioFileInfo) => {
    // Create a new audio track for this file
    const track = addTrack('audio', file.filename.replace(/\.[^.]+$/, ''))
    selectTrack(track.id)

    // Calculate duration in beats from seconds
    const secPerBeat = 60 / bpm
    const durationBeats = file.durationSecs
      ? Math.ceil(file.durationSecs / secPerBeat)
      : 8

    // Add clip to the new audio track via store
    const { addClip, updateClip } = useDAWStore.getState()
    const clip = addClip(track.id, 0, durationBeats)
    updateClip(track.id, clip.id, {
      name: file.filename,
      audioUrl: audioFileUrl(file.id),
    })
  }, [addTrack, selectTrack, bpm])

  return (
    <div className="flex flex-col h-full">
      {/* Upload zone */}
      <AudioUploadZone isUploading={isUploading} onUpload={handleUpload} />

      {/* File list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide mt-2">
        {audioFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Headphones size={24} className="text-text-muted/30" />
            <span className="text-2xs font-lcd text-text-muted/60 text-center px-4">
              No audio files uploaded.
              <br />
              Drop files above to get started.
            </span>
          </div>
        ) : (
          audioFiles.map((file) => (
            <AudioFileCard
              key={file.id}
              file={file}
              isPreviewing={previewingId === file.id}
              onPreview={handlePreview}
              onInsert={handleInsert}
            />
          ))
        )}
      </div>
    </div>
  )
}
