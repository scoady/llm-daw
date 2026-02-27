import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { LibraryClip, LibraryClipCategory, AudioFileInfo } from '@/types'
import { libraryApi, uploadApi } from '@/services/apiClient'

interface LibraryState {
  sidebarOpen: boolean
  activeTab: 'clips' | 'audio' | 'instruments'
  clips: LibraryClip[]
  audioFiles: AudioFileInfo[]
  isLoading: boolean
  selectedCategory: LibraryClipCategory | 'all'
  searchQuery: string
  previewingClipId: string | null
  isUploading: boolean
}

interface LibraryActions {
  toggleSidebar(): void
  setSidebarOpen(open: boolean): void
  setActiveTab(tab: 'clips' | 'audio' | 'instruments'): void
  setSelectedCategory(category: LibraryClipCategory | 'all'): void
  setSearchQuery(query: string): void
  setPreviewingClipId(id: string | null): void
  fetchClips(): Promise<void>
  fetchAudioFiles(): Promise<void>
  saveClipToLibrary(clip: LibraryClip): Promise<void>
  deleteClip(id: string): Promise<void>
  uploadAudioFile(file: File): Promise<AudioFileInfo>
}

export const useLibraryStore = create<LibraryState & LibraryActions>()(
  immer((set, get) => ({
    sidebarOpen: false,
    activeTab: 'clips',
    clips: [],
    audioFiles: [],
    isLoading: false,
    selectedCategory: 'all',
    searchQuery: '',
    previewingClipId: null,
    isUploading: false,

    toggleSidebar: () => set((s) => { s.sidebarOpen = !s.sidebarOpen }),
    setSidebarOpen: (open) => set((s) => { s.sidebarOpen = open }),
    setActiveTab: (tab) => set((s) => { s.activeTab = tab }),
    setSelectedCategory: (category) => set((s) => { s.selectedCategory = category }),
    setSearchQuery: (query) => set((s) => { s.searchQuery = query }),
    setPreviewingClipId: (id) => set((s) => { s.previewingClipId = id }),

    fetchClips: async () => {
      set((s) => { s.isLoading = true })
      try {
        const { selectedCategory, searchQuery } = get()
        const category = selectedCategory === 'all' ? undefined : selectedCategory
        const search = searchQuery || undefined
        const clips = await libraryApi.list(category, search)
        set((s) => { s.clips = clips; s.isLoading = false })
      } catch {
        set((s) => { s.isLoading = false })
      }
    },

    fetchAudioFiles: async () => {
      try {
        const files = await uploadApi.listAudio()
        set((s) => { s.audioFiles = files })
      } catch {
        // silently fail — API may be unavailable
      }
    },

    saveClipToLibrary: async (clip) => {
      await libraryApi.save(clip)
      // Refresh the list
      get().fetchClips()
    },

    deleteClip: async (id) => {
      await libraryApi.delete(id)
      set((s) => { s.clips = s.clips.filter((c) => c.id !== id) })
    },

    uploadAudioFile: async (file) => {
      set((s) => { s.isUploading = true })
      try {
        const info = await uploadApi.audio(file)
        set((s) => {
          s.audioFiles.push(info)
          s.isUploading = false
        })
        return info
      } catch (err) {
        set((s) => { s.isUploading = false })
        throw err
      }
    },
  }))
)
