import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Music, Sparkles, Keyboard, Waves, Cpu, Trash2 } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { LEDIndicator } from '@/components/common/LEDIndicator'
import { projectsApi } from '@/services/apiClient'

interface ProjectSummary {
  id: string
  name: string
  bpm: number
  timeSignature: [number, number]
  createdAt: string
  updatedAt: string
}

// Animated gradient mesh background
function GradientMesh() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Base dark */}
      <div className="absolute inset-0" style={{ background: '#060810' }} />

      {/* Animated gradient blobs */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(108, 99, 255, 0.3) 0%, transparent 70%)',
          top: '-200px',
          right: '-200px',
          animation: 'float 12s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(0, 212, 255, 0.25) 0%, transparent 70%)',
          bottom: '-100px',
          left: '-100px',
          animation: 'float 15s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(57, 255, 20, 0.2) 0%, transparent 70%)',
          top: '40%',
          left: '30%',
          animation: 'float 18s ease-in-out infinite',
          animationDelay: '-5s',
        }}
      />

      {/* Scan lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      {/* Noise grain */}
      <div className="absolute inset-0 noise-texture opacity-50" />
    </div>
  )
}

// Logo with shimmer effect
function ShimmerLogo() {
  return (
    <div className="relative inline-flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(108,99,255,0.05) 100%)',
          border: '1px solid rgba(108, 99, 255, 0.2)',
          boxShadow: '0 0 20px rgba(108, 99, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <Music size={20} className="text-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(108,99,255,0.6))' }} />
      </div>
      <div>
        <h1
          className="text-xl font-bold font-lcd text-transparent bg-clip-text tracking-wider"
          style={{
            backgroundImage: 'linear-gradient(135deg, #6c63ff 0%, #00d4ff 50%, #6c63ff 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        >
          LLM-DAW
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <LEDIndicator on color="green" size="xs" />
          <span className="text-[9px] font-lcd text-text-muted uppercase tracking-[0.2em]">
            Neural Audio Workstation
          </span>
        </div>
      </div>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function HomePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    projectsApi.list()
      .then((data) => setProjects(data as ProjectSummary[]))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await projectsApi.delete(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="h-full flex flex-col overflow-auto relative">
      <GradientMesh />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-8 py-4 border-b border-border-subtle/50"
        style={{
          background: 'linear-gradient(180deg, rgba(14, 16, 24, 0.9) 0%, rgba(10, 12, 18, 0.8) 100%)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <ShimmerLogo />
        <div className="flex items-center gap-3">
          <span
            className="text-[9px] font-lcd px-2.5 py-1 rounded uppercase tracking-wider"
            style={{
              color: '#39ff14',
              background: 'rgba(57, 255, 20, 0.06)',
              border: '1px solid rgba(57, 255, 20, 0.15)',
              textShadow: '0 0 6px rgba(57, 255, 20, 0.3)',
            }}
          >
            Beta v0.1
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16 relative" style={{ zIndex: 10 }}>
        <div className="max-w-2xl w-full space-y-10 animate-fade-in">
          {/* Hero text */}
          <div className="text-center space-y-5">
            <h2 className="text-4xl font-bold tracking-tight">
              <span className="text-text-primary">Create music with </span>
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #6c63ff 0%, #00d4ff 100%)',
                  filter: 'drop-shadow(0 0 20px rgba(108,99,255,0.3))',
                }}
              >
                AI
              </span>
            </h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed font-lcd">
              Plug in your MIDI keyboard, play a melody, and let AI analyze your music —
              suggesting harmonies, continuations, and new ideas.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex items-center justify-center gap-3">
            {[
              { icon: Keyboard, label: 'MIDI Input', color: '#00d4ff' },
              { icon: Music, label: 'Multi-track', color: '#6c63ff' },
              { icon: Sparkles, label: 'AI Analysis', color: '#ff9f1c' },
              { icon: Waves, label: 'Live Synth', color: '#39ff14' },
              { icon: Cpu, label: 'Neural Engine', color: '#ff6bd6' },
            ].map(({ icon: Icon, label, color }, i) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-lcd transition-all cursor-default group"
                style={{
                  background: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.05)`,
                  border: `1px solid rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`,
                  color: `${color}cc`,
                  animationDelay: `${i * 100}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.12)`
                  e.currentTarget.style.borderColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.35)`
                  e.currentTarget.style.boxShadow = `0 0 12px rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.05)`
                  e.currentTarget.style.borderColor = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <Icon size={12} />
                {label}
              </div>
            ))}
          </div>

          {/* New project button */}
          <div className="flex justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/project/new')}
              className="px-10 font-lcd tracking-wider"
            >
              <Plus size={16} />
              New Project
            </Button>
          </div>

          {/* Recent projects */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <LEDIndicator on color="cyan" size="xs" />
              <h3 className="text-[9px] text-text-muted uppercase tracking-[0.15em] font-lcd font-medium">
                Recent Projects
              </h3>
            </div>
            <div className="grid gap-2">
              {loading ? (
                <div className="text-center py-6 text-text-muted text-xs">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">No projects yet. Create one to get started.</div>
              ) : projects.map((project, i) => (
                <button
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg transition-all group text-left w-full"
                  style={{
                    background: 'linear-gradient(180deg, rgba(18, 21, 30, 0.8) 0%, rgba(13, 16, 24, 0.8) 100%)',
                    border: '1px solid rgba(45, 51, 72, 0.3)',
                    backdropFilter: 'blur(8px)',
                    animationDelay: `${i * 80}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.3)'
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(108, 99, 255, 0.08)'
                    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(20, 24, 36, 0.9) 0%, rgba(15, 18, 28, 0.9) 100%)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(45, 51, 72, 0.3)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(18, 21, 30, 0.8) 0%, rgba(13, 16, 24, 0.8) 100%)'
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: 'linear-gradient(180deg, rgba(108,99,255,0.08) 0%, rgba(108,99,255,0.02) 100%)',
                      border: '1px solid rgba(108, 99, 255, 0.12)',
                    }}
                  >
                    <Music size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{project.name}</div>
                    <div className="text-[9px] text-text-muted font-lcd flex items-center gap-2">
                      <span className="text-accent">{project.bpm}</span> BPM
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] text-text-muted font-lcd">{timeAgo(project.updatedAt)}</span>
                      <LEDIndicator on color="green" size="xs" />
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="p-1.5 rounded text-text-muted/30 hover:text-neon-red/80 hover:bg-neon-red/5 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div
        className="relative flex items-center justify-center px-6 py-2 border-t border-border-subtle/30"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 12, 18, 0.9) 0%, rgba(8, 9, 11, 0.95) 100%)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <span className="text-[9px] font-lcd text-text-muted/40 tracking-wider uppercase">
          Powered by Claude AI Neural Engine
        </span>
      </div>
    </div>
  )
}
