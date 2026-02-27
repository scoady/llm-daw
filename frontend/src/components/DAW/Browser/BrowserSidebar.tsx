import { X } from 'lucide-react'
import { useLibraryStore } from '@/store/libraryStore'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { BrowserTabBar } from './BrowserTabBar'
import { ClipBrowser } from './ClipBrowser'
import { AudioBrowser } from './AudioBrowser'
import { InstrumentBrowser } from './InstrumentBrowser'

export function BrowserSidebar() {
  const { activeTab, setActiveTab, setSidebarOpen } = useLibraryStore()

  return (
    <div
      className="flex flex-col h-full w-[280px] min-w-[280px] select-none"
      style={{
        background: 'linear-gradient(180deg, #191c28 0%, #161922 100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border-subtle/50"
        style={{
          background: 'linear-gradient(180deg, #1c2030 0%, #191c28 100%)',
        }}
      >
        <div className="flex items-center gap-2">
          <LEDIndicator on color="cyan" size="xs" />
          <span
            className="text-xs font-bold font-lcd tracking-wider uppercase"
            style={{ color: '#00d4ff' }}
          >
            Browser
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <BrowserTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'clips' && <ClipBrowser />}
        {activeTab === 'audio' && <AudioBrowser />}
        {activeTab === 'instruments' && <InstrumentBrowser />}
      </div>
    </div>
  )
}
