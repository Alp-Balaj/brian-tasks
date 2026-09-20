import type { Task } from '../domain/task'
import type { Space } from '../domain/space'
import type { CheckIn, RoutineRecord } from '../domain/routine'
import type { Tombstone } from './tombstones'
import { migrateV1, migrateV2, type SnapshotV2 } from './migrate'

/** Everything the app persists on this Device, saved and loaded as one unit. */
export interface Snapshot {
  tasks: Task[]
  spaces: Space[]
  routines: RoutineRecord[]
  checkIns: CheckIn[]
  /** Deletions the server has not been told about yet. */
  tombstones: Tombstone[]
}

/**
 * On-device persistence boundary. The stores only ever talk to this interface;
 * the server is reached separately by `sync/engine.ts`, which reads and writes
 * the same stores. Swapping localStorage for IndexedDB is a matter of writing
 * another adapter — no view code changes.
 */
export interface Repository {
  /** `null` means nothing stored yet (first run) — the caller decides how to seed. */
  load(): Promise<Snapshot | null>
  save(snapshot: Snapshot): Promise<void>
}

const V3_KEY = 'brian-tasks:v3'
const V2_KEY = 'brian-tasks:v2'
const V1_KEY = 'brian-tasks:v1'

export const localStorageRepository: Repository = {
  async load() {
    try {
      const v3 = parse(localStorage.getItem(V3_KEY))
      if (isSnapshot(v3)) return v3
      // One-time upgrades. Older keys are left in place so an older build still works.
      const v2 = parse(localStorage.getItem(V2_KEY))
      if (isSnapshotV2(v2)) return upgraded(migrateV2(v2))
      const v1 = parse(localStorage.getItem(V1_KEY))
      if (v1) return upgraded(migrateV2(migrateV1(Array.isArray(v1) ? v1 : [])))
      return null
    } catch {
      return null
    }
  },
  async save(snapshot) {
    try {
      localStorage.setItem(V3_KEY, JSON.stringify(snapshot))
    } catch {
      // Storage quota / private mode — the in-memory state still works for the session.
    }
  },
}

async function upgraded(snapshot: Snapshot): Promise<Snapshot> {
  await localStorageRepository.save(snapshot)
  return snapshot
}

const parse = (raw: string | null): unknown => (raw ? JSON.parse(raw) : null)

function isSnapshotV2(v: unknown): v is SnapshotV2 {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return Array.isArray(s.tasks) && Array.isArray(s.spaces) && Array.isArray(s.routines)
}

function isSnapshot(v: unknown): v is Snapshot {
  if (!isSnapshotV2(v)) return false
  const s = v as unknown as Record<string, unknown>
  return Array.isArray(s.checkIns) && Array.isArray(s.tombstones)
}
