/**
 * MIDI Input Service — wraps the Web MIDI API for real-time MIDI keyboard input.
 *
 * Enumerates connected MIDI input devices, listens for note-on/note-off messages,
 * and dispatches events via a simple callback system.
 */

import type { MIDIDeviceInfo } from '@/types'

export interface MIDINoteEvent {
  pitch: number       // 0-127
  velocity: number    // 0-127
  channel: number     // 0-15
  timestamp: number   // DOMHighResTimeStamp
}

type NoteOnCallback = (event: MIDINoteEvent) => void
type NoteOffCallback = (event: MIDINoteEvent) => void
type DeviceChangeCallback = (devices: MIDIDeviceInfo[]) => void

class MIDIInputService {
  private access: MIDIAccess | null = null
  private activeInput: MIDIInput | null = null
  private noteOnCallbacks: NoteOnCallback[] = []
  private noteOffCallbacks: NoteOffCallback[] = []
  private deviceChangeCallbacks: DeviceChangeCallback[] = []
  private supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  get isSupported(): boolean {
    return this.supported
  }

  async init(): Promise<boolean> {
    if (!this.supported) return false
    if (this.access) return true

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.access.onstatechange = () => this.handleStateChange()
      this.handleStateChange()
      return true
    } catch {
      console.warn('Web MIDI API access denied')
      return false
    }
  }

  getDevices(): MIDIDeviceInfo[] {
    if (!this.access) return []
    const devices: MIDIDeviceInfo[] = []
    this.access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name ?? 'Unknown Device',
        manufacturer: input.manufacturer ?? 'Unknown',
        state: input.state as 'connected' | 'disconnected',
      })
    })
    return devices
  }

  selectDevice(deviceId: string | null): void {
    // Detach from current input
    if (this.activeInput) {
      this.activeInput.onmidimessage = null
      this.activeInput = null
    }

    if (!deviceId || !this.access) return

    const input = this.access.inputs.get(deviceId)
    if (input) {
      this.activeInput = input
      this.activeInput.onmidimessage = (e) => this.handleMessage(e)
    }
  }

  getActiveDeviceId(): string | null {
    return this.activeInput?.id ?? null
  }

  // ── Event subscriptions ──────────────────────────────────────────────────

  onNoteOn(cb: NoteOnCallback): () => void {
    this.noteOnCallbacks.push(cb)
    return () => {
      this.noteOnCallbacks = this.noteOnCallbacks.filter((c) => c !== cb)
    }
  }

  onNoteOff(cb: NoteOffCallback): () => void {
    this.noteOffCallbacks.push(cb)
    return () => {
      this.noteOffCallbacks = this.noteOffCallbacks.filter((c) => c !== cb)
    }
  }

  onDeviceChange(cb: DeviceChangeCallback): () => void {
    this.deviceChangeCallbacks.push(cb)
    return () => {
      this.deviceChangeCallbacks = this.deviceChangeCallbacks.filter((c) => c !== cb)
    }
  }

  // ── Internal handlers ─────────────────────────────────────────────────────

  private handleMessage(e: MIDIMessageEvent): void {
    const data = e.data
    if (!data || data.length < 3) return

    const status = data[0]
    const command = status & 0xf0
    const channel = status & 0x0f
    const pitch = data[1]
    const velocity = data[2]

    const event: MIDINoteEvent = {
      pitch,
      velocity,
      channel,
      timestamp: e.timeStamp,
    }

    if (command === 0x90 && velocity > 0) {
      // Note On
      this.noteOnCallbacks.forEach((cb) => cb(event))
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note Off (or Note On with velocity 0)
      this.noteOffCallbacks.forEach((cb) => cb(event))
    }
  }

  private handleStateChange(): void {
    const devices = this.getDevices()
    this.deviceChangeCallbacks.forEach((cb) => cb(devices))

    // Auto-select first connected device if none active
    if (!this.activeInput) {
      const first = devices.find((d) => d.state === 'connected')
      if (first) this.selectDevice(first.id)
    }

    // If active device disconnected, clear it
    if (this.activeInput && this.activeInput.state === 'disconnected') {
      this.activeInput = null
      const first = devices.find((d) => d.state === 'connected')
      if (first) this.selectDevice(first.id)
    }
  }

  dispose(): void {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null
    }
    this.noteOnCallbacks = []
    this.noteOffCallbacks = []
    this.deviceChangeCallbacks = []
  }
}

// Singleton export
export const midiInputService = new MIDIInputService()
