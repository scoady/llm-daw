import { useEffect } from 'react'
import { useDAWStore } from '@/store/dawStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useAudioEngine } from './useAudioEngine'

/**
 * Global keyboard shortcuts for the DAW.
 */
export function useKeyboardShortcuts() {
  const { play, pause, stop } = useAudioEngine()
  const {
    transport,
    zoomIn,
    zoomOut,
    selectedClipId,
    selectedTrackId,
    tracks,
    removeClip,
    removeTrack,
    openPianoRoll,
    addTrack,
    startRecording,
    stopRecording,
    toggleAIPanel,
  } = useDAWStore()
  const toggleSidebar = useLibraryStore((s) => s.toggleSidebar)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          if (transport.isPlaying) pause()
          else play()
          break

        case 'Escape':
          stop()
          break

        case 'Equal':
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); zoomIn() }
          break

        case 'Minus':
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); zoomOut() }
          break

        case 'Backspace':
        case 'Delete':
          if (selectedClipId) {
            for (const t of tracks) {
              if (t.clips.find((c) => c.id === selectedClipId)) {
                removeClip(t.id, selectedClipId)
                break
              }
            }
          } else if (selectedTrackId) {
            removeTrack(selectedTrackId)
          }
          break

        case 'KeyE':
          if (selectedClipId) openPianoRoll(selectedClipId)
          break

        case 'KeyT':
          if (e.shiftKey) addTrack('midi')
          break

        case 'KeyR':
          if (transport.isRecording) stopRecording()
          else { startRecording(); if (!transport.isPlaying) play() }
          break

        case 'KeyA':
          if (!e.metaKey && !e.ctrlKey) toggleAIPanel()
          break

        case 'KeyB':
          if (!e.metaKey && !e.ctrlKey) toggleSidebar()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    transport.isPlaying, transport.isRecording, play, pause, stop,
    zoomIn, zoomOut,
    selectedClipId, selectedTrackId, tracks,
    removeClip, removeTrack, openPianoRoll, addTrack,
    startRecording, stopRecording, toggleAIPanel, toggleSidebar,
  ])
}
