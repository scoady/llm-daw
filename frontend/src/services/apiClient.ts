import axios from 'axios'
import type { Project, Track, Note, AnalysisResult, Suggestion, LibraryClip, AudioFileInfo } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Auth interceptor ─────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () =>
    api.get<Project[]>('/api/projects').then((r) => r.data),

  get: (id: string) =>
    api.get<Project>(`/api/projects/${id}`).then((r) => r.data),

  create: (data: { name: string; bpm?: number }) =>
    api.post<Project>('/api/projects', data).then((r) => r.data),

  update: (id: string, data: Partial<Project>) =>
    api.put<Project>(`/api/projects/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/projects/${id}`).then((r) => r.data),

  save: (id: string, project: Project) =>
    api.put<Project>(`/api/projects/${id}`, project).then((r) => r.data),
}

// ─── Tracks ───────────────────────────────────────────────────────────────────
export const tracksApi = {
  create: (projectId: string, data: Partial<Track>) =>
    api.post<Track>(`/api/projects/${projectId}/tracks`, data).then((r) => r.data),

  update: (projectId: string, trackId: string, data: Partial<Track>) =>
    api.put<Track>(`/api/projects/${projectId}/tracks/${trackId}`, data).then((r) => r.data),

  delete: (projectId: string, trackId: string) =>
    api.delete(`/api/projects/${projectId}/tracks/${trackId}`).then((r) => r.data),
}

// ─── File Upload ──────────────────────────────────────────────────────────────
export const uploadApi = {
  audio: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<AudioFileInfo>(
      '/api/upload/audio',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then((r) => r.data)
  },
}

// ─── Library ──────────────────────────────────────────────────────────────────
export const libraryApi = {
  list: (category?: string, search?: string) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    const qs = params.toString()
    return api.get<LibraryClip[]>(`/api/library/clips${qs ? `?${qs}` : ''}`).then((r) => r.data)
  },

  get: (id: string) =>
    api.get<LibraryClip>(`/api/library/clips/${id}`).then((r) => r.data),

  save: (clip: LibraryClip) =>
    api.post<{ ok: boolean; id: string }>('/api/library/clips', clip).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/library/clips/${id}`).then((r) => r.data),
}

// ─── Audio file URL helper ──────────────────────────────────────────────────
export function audioFileUrl(id: string): string {
  return `${API_BASE}/api/audio/${id}`
}

// ─── AI Analysis & Generation ─────────────────────────────────────────────────

interface AIAnalyzeResponse {
  analysis: AnalysisResult
  suggestions: Suggestion[]
  metadata: { model: string; inputTokens: number; outputTokens: number }
}

interface AIGenerateResponse {
  notes: Note[]
  durationBeats: number
  metadata: { model: string }
}

export const aiClient = {
  analyze: (notes: Note[], bpm: number, prompt: string, targetInstrument?: string) =>
    api.post<AIAnalyzeResponse>('/api/ai/analyze', { notes, bpm, prompt, targetInstrument }).then((r) => r.data),

  generate: (seedNotes: Note[], bpm: number, type: string, bars: number, options?: { key?: string; scale?: string; style?: string }) =>
    api.post<AIGenerateResponse>('/api/ai/generate', { seedNotes, bpm, type, bars, ...options }).then((r) => r.data),
}
