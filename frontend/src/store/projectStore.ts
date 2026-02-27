import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ApiProject } from '@/types'

interface ProjectState {
  projects: ApiProject[]
  loading: boolean
  error: string | null
}

interface ProjectActions {
  setProjects(projects: ApiProject[]): void
  addProject(project: ApiProject): void
  removeProject(id: string): void
  setLoading(loading: boolean): void
  setError(error: string | null): void
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  immer((set) => ({
    projects: [],
    loading: false,
    error: null,

    setProjects: (projects) => set((s) => { s.projects = projects }),
    addProject:  (project)  => set((s) => { s.projects.unshift(project) }),
    removeProject: (id) => set((s) => {
      s.projects = s.projects.filter((p) => p.id !== id)
    }),
    setLoading: (loading) => set((s) => { s.loading = loading }),
    setError:   (error)   => set((s) => { s.error = error }),
  }))
)
