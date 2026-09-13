import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { DEFAULT_SPACE_ID, type Space, type SpacePatch } from '../domain/space'
import { useTasks } from './tasks'
import { useSpaceSelection } from './ui'

interface SpaceState {
  /** Always sorted by `order`. */
  spaces: Space[]
  add: (name: string, colour: string) => Space
  update: (id: string, patch: SpacePatch) => void
  /** Full new order; ids not listed keep their relative order at the end. */
  reorder: (ids: string[]) => void
  /** Refuses the default space. Tasks of the removed space move to the default one (Q16). */
  remove: (id: string) => void
  replaceAll: (spaces: Space[]) => void
}

export const sortSpaces = (spaces: Space[]) => [...spaces].sort((a, b) => a.order - b.order)

export const useSpaces = create<SpaceState>((set, get) => ({
  spaces: [],

  add: (name, colour) => {
    const spaces = get().spaces
    const space: Space = {
      id: nanoid(8),
      name: name.trim(),
      colour,
      order: spaces.length === 0 ? 0 : Math.max(...spaces.map((s) => s.order)) + 1,
    }
    set({ spaces: sortSpaces([...spaces, space]) })
    return space
  },

  update: (id, patch) => {
    set({ spaces: sortSpaces(get().spaces.map((s) => (s.id === id ? { ...s, ...patch } : s))) })
  },

  reorder: (ids) => {
    const rank = new Map(ids.map((id, i) => [id, i]))
    const spaces = get().spaces
    const listed = spaces.filter((s) => rank.has(s.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    const rest = spaces.filter((s) => !rank.has(s.id))
    set({ spaces: [...listed, ...rest].map((s, order) => (s.order === order ? s : { ...s, order })) })
  },

  remove: (id) => {
    if (id === DEFAULT_SPACE_ID) return
    if (!get().spaces.some((s) => s.id === id)) return
    const ts = new Date().toISOString()
    useTasks.setState((s) => ({
      tasks: s.tasks.map((t) => (t.spaceId === id ? { ...t, spaceId: DEFAULT_SPACE_ID, updatedAt: ts } : t)),
    }))
    const ui = useSpaceSelection.getState()
    if (ui.selected === id) ui.select(DEFAULT_SPACE_ID)
    if (ui.lastUsedSpaceId === id) ui.setLastUsed(DEFAULT_SPACE_ID)
    set({ spaces: get().spaces.filter((s) => s.id !== id) })
  },

  replaceAll: (spaces) => set({ spaces: sortSpaces(spaces) }),
}))
