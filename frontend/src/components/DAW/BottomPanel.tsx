/**
 * BottomPanel — Tabbed container for MIXER / EDITOR / MASTER views.
 * Renders a slim tab bar with LED indicators and the active tab's content.
 */
import { clsx } from 'clsx'
import { useDAWStore } from '@/store/dawStore'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { Mixer } from '@/components/DAW/Mixer'
import { PianoRollEditor } from '@/components/DAW/PianoRollEditor'
import { MasterEQ } from '@/components/DAW/MasterEQ'
import { Visualizer } from '@/components/DAW/Visualizer'
import { Piano } from '@/components/DAW/Piano'

type BottomTab = 'mixer' | 'editor' | 'master' | 'keys'

const TABS: { id: BottomTab; label: string; color: 'cyan' | 'accent' | 'green' | 'amber' }[] = [
  { id: 'mixer', label: 'MIXER', color: 'cyan' },
  { id: 'editor', label: 'EDITOR', color: 'accent' },
  { id: 'keys', label: 'KEYS', color: 'amber' },
  { id: 'master', label: 'MASTER', color: 'green' },
]

export function BottomPanel() {
  const { bottomTab, setBottomTab } = useDAWStore()

  return (
    <div className="flex flex-col h-full border-t border-border-subtle">
      {/* Tab bar */}
      <div
        className="flex items-center h-[28px] flex-shrink-0 select-none relative"
        style={{
          background: 'linear-gradient(180deg, #14171f 0%, #0d1018 100%)',
          borderBottom: '1px solid rgba(45, 51, 72, 0.3)',
        }}
      >
        {/* Scan-line texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)',
          }}
        />

        {TABS.map((tab) => {
          const isActive = bottomTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setBottomTab(tab.id)}
              className={clsx(
                'relative flex items-center gap-1.5 px-4 h-full transition-all z-10',
                isActive
                  ? 'text-text-primary'
                  : 'text-text-muted/50 hover:text-text-muted/80'
              )}
            >
              {/* LED dot */}
              <LEDIndicator
                on={isActive}
                color={tab.color}
                size="xs"
              />

              {/* Label */}
              <span
                className="text-2xs font-lcd tracking-[0.15em] font-medium"
                style={isActive ? {
                  textShadow: tab.color === 'cyan'
                    ? '0 0 8px rgba(0, 212, 255, 0.3)'
                    : tab.color === 'accent'
                      ? '0 0 8px rgba(108, 99, 255, 0.3)'
                      : tab.color === 'amber'
                        ? '0 0 8px rgba(255, 159, 28, 0.3)'
                        : '0 0 8px rgba(57, 255, 20, 0.3)',
                } : undefined}
              >
                {tab.label}
              </span>

              {/* Active underline with glow */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{
                    background: tab.color === 'cyan'
                      ? '#00d4ff'
                      : tab.color === 'accent'
                        ? '#6c63ff'
                        : tab.color === 'amber'
                          ? '#ff9f1c'
                          : '#39ff14',
                    boxShadow: tab.color === 'cyan'
                      ? '0 0 8px rgba(0, 212, 255, 0.5), 0 0 2px rgba(0, 212, 255, 0.8)'
                      : tab.color === 'accent'
                        ? '0 0 8px rgba(108, 99, 255, 0.5), 0 0 2px rgba(108, 99, 255, 0.8)'
                        : tab.color === 'amber'
                          ? '0 0 8px rgba(255, 159, 28, 0.5), 0 0 2px rgba(255, 159, 28, 0.8)'
                          : '0 0 8px rgba(57, 255, 20, 0.5), 0 0 2px rgba(57, 255, 20, 0.8)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {bottomTab === 'mixer' && <Visualizer />}
        {bottomTab === 'mixer' && <Mixer />}
        {bottomTab === 'editor' && <PianoRollEditor />}
        {bottomTab === 'keys' && <Piano />}
        {bottomTab === 'master' && <MasterEQ />}
      </div>
    </div>
  )
}
