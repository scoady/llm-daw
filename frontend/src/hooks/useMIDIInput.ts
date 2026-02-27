import { useEffect, useRef } from 'react'
import { useDAWStore } from '@/store/dawStore'
import { midiInputService } from '@/services/midiInputService'
import { audioEngine } from '@/services/audioEngine'
import type { MIDINoteEvent } from '@/services/midiInputService'

/**
 * Connects Web MIDI input to the audio engine and DAW store.
 *
 * - Initializes MIDI access and populates device list
 * - Routes note-on/off to the armed track's synth for real-time sound
 * - When recording, captures notes into the active recording clip
 */
export function useMIDIInput() {
  const pendingNotes = useRef<Map<number, { startBeat: number; velocity: number }>>(new Map())

  const {
    selectedMidiDeviceId,
    setMidiDevices,
    selectMidiDevice,
  } = useDAWStore()

  // Initialize Web MIDI on mount
  useEffect(() => {
    midiInputService.init().then((ok) => {
      if (ok) {
        setMidiDevices(midiInputService.getDevices())
      }
    })

    const unsub = midiInputService.onDeviceChange((devices) => {
      setMidiDevices(devices)
      // If we auto-selected a device, sync to store
      const activeId = midiInputService.getActiveDeviceId()
      if (activeId) {
        const state = useDAWStore.getState()
        if (!state.selectedMidiDeviceId) {
          selectMidiDevice(activeId)
        }
      }
    })

    return () => {
      unsub()
      midiInputService.dispose()
    }
  }, [])

  // Sync selected device to service
  useEffect(() => {
    midiInputService.selectDevice(selectedMidiDeviceId)
  }, [selectedMidiDeviceId])

  // Note-on handler
  useEffect(() => {
    const unsubOn = midiInputService.onNoteOn((event: MIDINoteEvent) => {
      const state = useDAWStore.getState()
      const armedTrack = state.tracks.find((t) => t.armed)
      const targetTrack = armedTrack ?? state.tracks.find((t) =>
        t.type === 'midi' || t.type === 'instrument'
      )

      if (!targetTrack) return

      // Ensure channel exists and play sound
      audioEngine.ensureChannel(targetTrack.id, targetTrack.type)
      audioEngine.triggerAttack(targetTrack.id, event.pitch, event.velocity)

      // Visual feedback
      useDAWStore.getState().addActiveMidiNote(event.pitch)

      // Recording: buffer the note start
      if (state.transport.isRecording && state.recordingClipId && state.recordingStartBeat !== null) {
        pendingNotes.current.set(event.pitch, {
          startBeat: state.transport.currentBeat - state.recordingStartBeat,
          velocity: event.velocity,
        })
      }
    })

    const unsubOff = midiInputService.onNoteOff((event: MIDINoteEvent) => {
      const state = useDAWStore.getState()
      const armedTrack = state.tracks.find((t) => t.armed)
      const targetTrack = armedTrack ?? state.tracks.find((t) =>
        t.type === 'midi' || t.type === 'instrument'
      )

      if (targetTrack) {
        audioEngine.triggerRelease(targetTrack.id, event.pitch)
      }

      // Visual feedback
      useDAWStore.getState().removeActiveMidiNote(event.pitch)

      // Recording: finalize the note
      if (state.transport.isRecording && state.recordingClipId) {
        const pending = pendingNotes.current.get(event.pitch)
        if (pending) {
          const currentBeat = state.transport.currentBeat - (state.recordingStartBeat ?? 0)
          const duration = Math.max(0.125, currentBeat - pending.startBeat)

          useDAWStore.getState().addNote(state.recordingClipId, {
            pitch: event.pitch,
            startBeat: pending.startBeat,
            durationBeats: duration,
            velocity: pending.velocity,
          })

          pendingNotes.current.delete(event.pitch)
        }
      }
    })

    return () => {
      unsubOn()
      unsubOff()
    }
  }, [])
}
