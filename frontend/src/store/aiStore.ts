import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { AIGenerationMode, AnalysisResult, Suggestion } from '@/types'

interface AIState {
  isGenerating: boolean
  error: string | null

  // User prompt
  prompt: string

  // Analysis results
  analysis: AnalysisResult | null
  suggestions: Suggestion[]

  // Generation settings
  mode: AIGenerationMode
  style: string
  bars: number
  intensity: number
  key: string
  scale: string

  // Preview
  previewingSuggestionId: string | null
}

interface AIActions {
  setGenerating(v: boolean): void
  setError(err: string | null): void
  setPrompt(prompt: string): void
  setAnalysis(analysis: AnalysisResult | null): void
  setSuggestions(suggestions: Suggestion[]): void
  setMode(mode: AIGenerationMode): void
  setStyle(style: string): void
  setBars(bars: number): void
  setIntensity(intensity: number): void
  setKey(key: string): void
  setScale(scale: string): void
  setPreviewingSuggestionId(id: string | null): void
  clearResults(): void
}

export const useAIStore = create<AIState & AIActions>()(
  immer((set) => ({
    isGenerating: false,
    error: null,
    prompt: '',
    analysis: null,
    suggestions: [],
    mode: 'beat',
    style: 'hip-hop',
    bars: 4,
    intensity: 0.7,
    key: 'C',
    scale: 'minor',
    previewingSuggestionId: null,

    setGenerating: (v)       => set((s) => { s.isGenerating = v }),
    setError:      (err)     => set((s) => { s.error = err }),
    setPrompt:     (prompt)  => set((s) => { s.prompt = prompt }),
    setAnalysis:   (analysis) => set((s) => { s.analysis = analysis }),
    setSuggestions: (suggestions) => set((s) => { s.suggestions = suggestions }),
    setMode:       (mode)    => set((s) => { s.mode = mode }),
    setStyle:      (style)   => set((s) => { s.style = style }),
    setBars:       (bars)    => set((s) => { s.bars = bars }),
    setIntensity:  (i)       => set((s) => { s.intensity = i }),
    setKey:        (key)     => set((s) => { s.key = key }),
    setScale:      (scale)   => set((s) => { s.scale = scale }),
    setPreviewingSuggestionId: (id) => set((s) => { s.previewingSuggestionId = id }),
    clearResults: () => set((s) => {
      s.analysis = null
      s.suggestions = []
      s.error = null
    }),
  }))
)
