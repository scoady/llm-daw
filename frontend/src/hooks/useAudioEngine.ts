import { useEffect, useRef, useCallback, useMemo } from 'react'
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
    updateRecordingDuration,
  } = useDAWStore()

  const rafRef = useRef<number>(0)

  // Sync BPM
  useEffect(() => {
    audioEngine.setBpm(bpm)
  }, [bpm])

  // Sync instrument presets to audio engine when they change
  const presetKey = useMemo(
    () => tracks.map((t) => `${t.id}:${t.instrument?.presetId ?? ''}`).join(','),
    [tracks]
  )

  useEffect(() => {
    for (const track of tracks) {
      if ((track.type === 'midi' || track.type === 'instrument') && track.instrument?.presetId) {
        audioEngine.setTrackInstrument(track.id, track.instrument.presetId, track.type)
      }
    }
  }, [presetKey])

  // Schedule tracks when playback starts (not on every track mutation)
  useEffect(() => {
    if (transport.isPlaying && !transport.isRecording) {
      audioEngine.scheduleTracks(tracks)
    }
  }, [transport.isPlaying])

  // Playhead animation loop + recording clip growth
  useEffect(() => {
    const tick = () => {
      if (audioEngine.isPlaying()) {
        const beat = audioEngine.getCurrentBeat()
        setCurrentBeat(beat)
        // Grow the recording clip as the playhead advances
        if (useDAWStore.getState().transport.isRecording) {
          updateRecordingDuration(beat)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [setCurrentBeat, updateRecordingDuration])

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
