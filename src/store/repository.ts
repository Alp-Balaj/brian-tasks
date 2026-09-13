import type { Task } from '../domain/task'
import type { Space } from '../domain/space'
import type { Routine } from '../domain/routine'
import { migrateV1 } from './migrate'

/** Everything the app persists, saved and loaded as one unit. */
export interface Snapshot {
  tasks: Task[]
  spaces: Space[]
  routines: Routine[]
}

/**
 * Persistence boundary. The app only ever talks to this interface, so swapping
 * localStorage for a real backend (REST, Supabase, SQLite via Tauri, ...) is a
 * matter of writing another adapter — no view code changes.
 */
export interface Repository {
  /** `null` means nothing stored yet (first run) — the caller decides how to seed. */
  load(): Promise<Snapshot | null>
  save(snapshot: Snapshot): Promise<void>
}

const V2_KEY = 'brian-tasks:v2'
const V1_KEY = 'brian-tasks:v1'

export const localStorageRepository: Repository = {
  async load() {
    try {
      const v2 = localStorage.getItem(V2_KEY)
      if (v2) {
        const parsed: unknown = JSON.parse(v2)
        return isSnapshot(parsed) ? parsed : null
      }
      // One-time upgrade. v1 is left in place so an older build still works.
      const v1 = localStorage.getItem(V1_KEY)
      if (v1) {
        const parsed: unknown = JSON.parse(v1)
        const snapshot = migrateV1(Array.isArray(parsed) ? parsed : [])
        await this.save(snapshot)
        return snapshot
      }
      return null
    } catch {
      return null
    }
  },
  async save(snapshot) {
    try {
      localStorage.setItem(V2_KEY, JSON.stringify(snapshot))
    } catch {
      // Storage quota / private mode — the in-memory state still works for the session.
    }
  },
}

function isSnapshot(v: unknown): v is Snapshot {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return Array.isArray(s.tasks) && Array.isArray(s.spaces) && Array.isArray(s.routines)
}
