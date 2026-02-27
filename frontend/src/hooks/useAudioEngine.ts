import { useEffect, useRef, useCallback } from 'react'
import { useDAWStore } from '@/store/dawStore'
import { audioEngine } from '@/services/audioEngine'

/**
 * Synchronises the DAW store transport state with the Tone.js audio engine.
 * Call once at the top-level of the app.
 */
export function useAudioEngine() {
  const {
    bpm,
    tracks,
    transport,
    setCurrentBeat,
    setPlaying,
  } = useDAWStore()

  const rafRef = useRef<number>(0)

  // Sync BPM
  useEffect(() => {
    audioEngine.setBpm(bpm)
  }, [bpm])

  // Schedule tracks when playback starts (not on every track mutation)
  useEffect(() => {
    if (transport.isPlaying && !transport.isRecording) {
      audioEngine.scheduleTracks(tracks)
    }
  }, [transport.isPlaying])

  // Playhead animation loop
  useEffect(() => {
    const tick = () => {
      if (audioEngine.isPlaying()) {
        setCurrentBeat(audioEngine.getCurrentBeat())
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [setCurrentBeat])

  const play = useCallback(async () => {
    audioEngine.scheduleTracks(tracks)
    await audioEngine.play()
    setPlaying(true)
  }, [tracks, setPlaying])

  const pause = useCallback(() => {
    audioEngine.pause()
    setPlaying(false)
  }, [setPlaying])

  const stop = useCallback(() => {
    audioEngine.stop()
    setPlaying(false)
    setCurrentBeat(0)
  }, [setPlaying, setCurrentBeat])

  const seek = useCallback((beat: number) => {
    audioEngine.seek(beat)
    setCurrentBeat(beat)
  }, [setCurrentBeat])

  return { play, pause, stop, seek }
}
