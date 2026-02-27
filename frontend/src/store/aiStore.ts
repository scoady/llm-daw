import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { AIGenerationMode, AnalysisResult, Suggestion, AccompanyResult } from '@/types'

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

  // Instrument targeting
  targetPresetId: string | null

  // Auto-accompaniment
  isAccompanying: boolean
  accompanyResult: AccompanyResult | null
  accompanyStyle: string
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
  setTargetPresetId(id: string | null): void
  setAccompanying(v: boolean): void
  setAccompanyResult(result: AccompanyResult | null): void
  setAccompanyStyle(style: string): void
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
    targetPresetId: null,
    isAccompanying: false,
    accompanyResult: null,
    accompanyStyle: 'pop',

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
    setTargetPresetId: (id) => set((s) => { s.targetPresetId = id }),
    setAccompanying: (v) => set((s) => { s.isAccompanying = v }),
    setAccompanyResult: (result) => set((s) => { s.accompanyResult = result }),
    setAccompanyStyle: (style) => set((s) => { s.accompanyStyle = style }),
    clearResults: () => set((s) => {
      s.analysis = null
      s.suggestions = []
      s.error = null
      s.targetPresetId = null
      s.accompanyResult = null
    }),
  }))
)
