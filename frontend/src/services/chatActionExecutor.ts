import { useDAWStore, selectClipById } from '@/store/dawStore'
import type { ChatAction } from '@/types'

/**
 * Execute a single chat action against the DAW store.
 * Returns a human-readable description of what was done.
 */
export function executeChatAction(action: ChatAction, clipId: string | null): string {
  const store = useDAWStore.getState()

  switch (action.type) {
    case 'transpose': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes to transpose'
      for (const note of clip.notes) {
        store.updateNote(clipId, note.id, {
          pitch: Math.max(0, Math.min(127, note.pitch + action.semitones)),
        })
      }
      return `Transposed ${clip.notes.length} notes by ${action.semitones > 0 ? '+' : ''}${action.semitones}`
    }

    case 'quantize': {
      if (!clipId) return 'No clip selected'
      store.quantizeClip(clipId, action.division)
      return `Quantized to ${action.division === 1 ? '1/4' : action.division === 0.5 ? '1/8' : action.division === 0.25 ? '1/16' : `${action.division}`} grid`
    }

    case 'setVelocity': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes'
      for (const note of clip.notes) {
        store.updateNote(clipId, note.id, { velocity: action.velocity })
      }
      return `Set velocity to ${action.velocity}`
    }

    case 'setVelocityRange': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes'
      for (const note of clip.notes) {
        const v = Math.floor(action.min + Math.random() * (action.max - action.min))
        store.updateNote(clipId, note.id, { velocity: v })
      }
      return `Randomized velocity ${action.min}-${action.max}`
    }

    case 'reverse': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes'
      const maxBeat = Math.max(...clip.notes.map((n) => n.startBeat + n.durationBeats))
      for (const note of clip.notes) {
        store.updateNote(clipId, note.id, {
          startBeat: maxBeat - note.startBeat - note.durationBeats,
        })
      }
      return `Reversed ${clip.notes.length} notes`
    }

    case 'timeStretch': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes'
      for (const note of clip.notes) {
        store.updateNote(clipId, note.id, {
          startBeat: note.startBeat * action.factor,
          durationBeats: note.durationBeats * action.factor,
        })
      }
      const track = store.tracks.find((t) => t.clips.some((c) => c.id === clipId))
      if (track) {
        store.updateClip(track.id, clipId, {
          durationBeats: clip.durationBeats * action.factor,
        })
      }
      return `Time-stretched by ${action.factor}x`
    }

    case 'deleteNotes': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (!clip?.notes?.length) return 'No notes'
      const targets = action.filter
        ? clip.notes.filter((n) => {
            if (action.filter!.pitchBelow !== undefined && n.pitch >= action.filter!.pitchBelow) return false
            if (action.filter!.pitchAbove !== undefined && n.pitch <= action.filter!.pitchAbove) return false
            if (action.filter!.velocityBelow !== undefined && n.velocity >= action.filter!.velocityBelow) return false
            return true
          })
        : [...clip.notes]
      for (const note of targets) {
        store.removeNote(clipId, note.id)
      }
      return `Deleted ${targets.length} notes`
    }

    case 'setBpm': {
      store.setBpm(action.bpm)
      return `Set BPM to ${action.bpm}`
    }

    case 'replaceNotes': {
      if (!clipId) return 'No clip selected'
      const clip = selectClipById(clipId)(store)
      if (clip?.notes) {
        for (const note of [...clip.notes]) {
          store.removeNote(clipId, note.id)
        }
      }
      for (const note of action.notes) {
        store.addNote(clipId, note)
      }
      if (action.notes.length > 0) {
        const maxBeat = Math.max(...action.notes.map((n) => n.startBeat + n.durationBeats))
        const track = store.tracks.find((t) => t.clips.some((c) => c.id === clipId))
        if (track) {
          store.updateClip(track.id, clipId, { durationBeats: Math.ceil(maxBeat / 4) * 4 })
        }
      }
      return `Replaced with ${action.notes.length} notes`
    }

    case 'addNotes': {
      if (!clipId) return 'No clip selected'
      for (const note of action.notes) {
        store.addNote(clipId, note)
      }
      if (action.notes.length > 0) {
        const clip = selectClipById(clipId)(store)
        if (clip) {
          const maxBeat = Math.max(...action.notes.map((n) => n.startBeat + n.durationBeats))
          if (maxBeat > clip.durationBeats) {
            const track = store.tracks.find((t) => t.clips.some((c) => c.id === clipId))
            if (track) {
              store.updateClip(track.id, clipId, { durationBeats: Math.ceil(maxBeat / 4) * 4 })
            }
          }
        }
      }
      return `Added ${action.notes.length} notes`
    }

    case 'addTrack': {
      const track = store.addTrack(action.trackType ?? 'midi', action.name)
      if (action.presetId) {
        store.setTrackInstrument(track.id, action.presetId)
      }
      if (action.notes?.length) {
        const clip = store.addClip(track.id, 0, action.durationBeats ?? 16)
        for (const note of action.notes) {
          store.addNote(clip.id, note)
        }
      }
      return `Created track "${action.name}"`
    }

    default:
      return 'Unknown action'
  }
}

/**
 * Execute all actions from a chat response.
 */
export function executeChatActions(actions: ChatAction[], clipId: string | null): string[] {
  return actions.map((action) => executeChatAction(action, clipId))
}
