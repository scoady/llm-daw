import { clsx } from 'clsx'
import { LEDIndicator } from '@/components/common/LEDIndicator'

type BrowserTab = 'clips' | 'audio' | 'instruments'

interface BrowserTabBarProps {
  activeTab: BrowserTab
  onTabChange: (tab: BrowserTab) => void
}

const TABS: { id: BrowserTab; label: string }[] = [
  { id: 'clips', label: 'CLIPS' },
  { id: 'audio', label: 'AUDIO' },
  { id: 'instruments', label: 'INSTR' },
]

export function BrowserTabBar({ activeTab, onTabChange }: BrowserTabBarProps) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle/50"
      style={{ background: 'linear-gradient(180deg, #0f1218 0%, #0c0e14 100%)' }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-lcd tracking-wider transition-all',
              active
                ? 'text-cyan bg-cyan/10'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-3'
            )}
          >
            <LEDIndicator on={active} color="cyan" size="xs" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
