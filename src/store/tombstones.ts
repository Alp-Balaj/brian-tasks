import { create } from 'zustand'
import type { ISODateTime } from '../domain/task'

/** The kinds of record that sync between Devices. Check-in ids are `routineId:date`. */
export type RowKind = 'task' | 'space' | 'routine' | 'checkin' | 'block' | 'placement'

/**
 * A deletion, remembered so that a Device that was offline learns about it when
 * it catches up. Kept locally only until the server has seen it.
 */
export interface Tombstone {
  kind: RowKind
  id: string
  deletedAt: ISODateTime
}

interface TombstoneState {
  tombstones: Tombstone[]
  bury: (kind: RowKind, id: string) => void
  replaceAll: (tombstones: Tombstone[]) => void
}

export const useTombstones = create<TombstoneState>((set, get) => ({
  tombstones: [],
  bury: (kind, id) => {
    const deletedAt = new Date().toISOString()
    set({ tombstones: [...get().tombstones.filter((t) => !(t.kind === kind && t.id === id)), { kind, id, deletedAt }] })
  },
  replaceAll: (tombstones) => set({ tombstones }),
}))
