import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SPACE_ID, type SpaceSelection } from '../domain/space'

interface UiState {
  /** What the switcher is set to. Governs Board, List, Calendar and Archive; Home ignores it (Q3). */
  selected: SpaceSelection
  select: (selection: SpaceSelection) => void
  /** Space of the most recently created task; preselected when a picker is shown (Q18). */
  lastUsedSpaceId: string
  setLastUsed: (id: string) => void
}

/** Per-device UI state, kept apart from the data snapshot so it never goes through migration. */
export const useSpaceSelection = create<UiState>()(
  persist(
    (set) => ({
      selected: DEFAULT_SPACE_ID,
      select: (selected) => set({ selected }),
      lastUsedSpaceId: DEFAULT_SPACE_ID,
      setLastUsed: (lastUsedSpaceId) => set({ lastUsedSpaceId }),
    }),
    { name: 'brian-tasks:ui' },
  ),
)
