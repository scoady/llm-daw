import { useState, useRef, useEffect } from 'react'
import { Keyboard, ChevronDown, Unplug } from 'lucide-react'
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { midiInputService } from '@/services/midiInputService'
import { midiToNoteName } from '@/services/midiService'
import { LEDIndicator } from '@/components/common/LEDIndicator'

export function MIDIStatus() {
  const {
    midiDevices,
    selectedMidiDeviceId,
    selectMidiDevice,
    activeMidiNotes,
  } = useDAWStore()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedDevice = midiDevices.find((d) => d.id === selectedMidiDeviceId)
  const hasActivity = activeMidiNotes.length > 0
  const lastNote = activeMidiNotes.length > 0
    ? midiToNoteName(activeMidiNotes[activeMidiNotes.length - 1])
    : null
  const lastVelocity = 0.7 // simulated

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const handleSelect = (deviceId: string) => {
    selectMidiDevice(deviceId)
    midiInputService.selectDevice(deviceId)
    setDropdownOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={clsx(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all',
          'border',
          selectedDevice
            ? '[background:linear-gradient(180deg,#1e2130_0%,#161921_100%)] border-border-subtle text-text-secondary hover:border-border-default'
            : '[background:linear-gradient(180deg,#1e2130_0%,#161921_100%)] border-border-subtle text-text-muted hover:border-border-default'
        )}
      >
        {/* Activity LED */}
        <LEDIndicator on={hasActivity} color="green" size="sm" pulse={hasActivity} />

        {/* Keyboard icon with glow */}
        <Keyboard size={12} className={clsx(
          'transition-all',
          hasActivity ? 'text-accent' : 'text-text-muted'
        )}
          style={hasActivity ? { filter: 'drop-shadow(0 0 4px rgba(108,99,255,0.5))' } : undefined}
        />

        {/* Device name or status */}
        <span className="max-w-[100px] truncate font-lcd">
          {selectedDevice?.name ?? 'No MIDI'}
        </span>

        {/* Last note played */}
        {lastNote && (
          <span className="font-lcd text-accent font-bold min-w-[24px] text-center midi-note-flash text-glow-accent">
            {lastNote}
          </span>
        )}

        {/* Mini velocity bar */}
        {hasActivity && (
          <div className="w-[2px] h-4 bg-surface-3 rounded-full overflow-hidden flex-shrink-0">
            <div
              className="w-full bg-accent rounded-full transition-all duration-100"
              style={{ height: `${lastVelocity * 100}%`, marginTop: `${(1 - lastVelocity) * 100}%` }}
            />
          </div>
        )}

        {/* Connection dots */}
        <div className="flex items-center gap-[2px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={clsx(
                'w-1 h-1 rounded-full',
                selectedDevice ? 'bg-vu-green' : 'bg-surface-4'
              )}
            />
          ))}
        </div>

        <ChevronDown size={10} className="text-text-muted" />
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-panel-raised z-50 overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #111420 0%, #0f1114 100%)', border: '1px solid #2d3348' }}
        >
          <div className="px-3 py-2 border-b border-border-subtle">
            <span className="text-2xs text-text-muted uppercase tracking-[0.15em] font-lcd font-medium">
              MIDI Devices
            </span>
          </div>

          {midiDevices.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Unplug size={20} className="mx-auto mb-2 text-text-muted" />
              <p className="text-xs text-text-muted font-lcd">No MIDI devices</p>
              <p className="text-2xs text-text-muted mt-1">Connect a keyboard and refresh</p>
            </div>
          ) : (
            <div className="py-1">
              {midiDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelect(device.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    device.id === selectedMidiDeviceId
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-surface-3'
                  )}
                >
                  <Keyboard size={14} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{device.name}</div>
                    <div className="text-2xs text-text-muted">{device.manufacturer}</div>
                  </div>
                  <LEDIndicator on={device.state === 'connected'} color="green" size="xs" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
