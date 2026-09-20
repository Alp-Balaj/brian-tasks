import type { Task } from '../domain/task'
import { DEFAULT_SPACE_ID, defaultSpace, type Space } from '../domain/space'
import type { CheckIn, Routine, RoutineRecord } from '../domain/routine'
import type { Snapshot } from './repository'

const ARCHIVED_TAG = 'archived'

/** The v2 on-device shape: Spaces without `updatedAt`, Check-ins inside each Routine. */
export interface SnapshotV2 {
  tasks: Task[]
  spaces: Omit<Space, 'updatedAt'>[]
  routines: Routine[]
}

/** The v3 on-device shape: v4 without Blocks and Placements. */
export type SnapshotV3 = Omit<Snapshot, 'blocks' | 'placements'>

/**
 * v1 → v2. v1 was a bare `Task[]` with no spaces, no routines, and "archived"
 * expressed as a tag. Every task lands in the default space, unpinned; the tag
 * becomes the `archived` flag and is removed (Q5, Q31). The seed goes through
 * this too, so it is tolerant of fields already being present.
 */
export function migrateV1(tasks: unknown[]): SnapshotV2 {
  return {
    tasks: tasks.filter(isRecord).map(migrateTask),
    spaces: [defaultSpace()],
    routines: [],
  }
}

/**
 * v2 → v3. Check-ins leave the Routine and become records of their own, and
 * Spaces gain `updatedAt`, so that every synced record can be compared between
 * Devices. Nothing is deleted, so there are no tombstones to carry over.
 */
export function migrateV2(v2: SnapshotV2): SnapshotV3 {
  const now = new Date().toISOString()
  const routines: RoutineRecord[] = []
  const checkIns: CheckIn[] = []
  for (const { checkIns: days, ...routine } of v2.routines) {
    routines.push(routine)
    for (const date of days ?? []) checkIns.push({ routineId: routine.id, date, updatedAt: routine.updatedAt })
  }
  return {
    tasks: v2.tasks,
    spaces: v2.spaces.map((s) => ({ ...s, updatedAt: (s as Partial<Space>).updatedAt ?? now })),
    routines,
    checkIns,
    tombstones: [],
  }
}

/**
 * v3 → v4. Blocks and Placements are new record kinds (D7); a v3 Device simply has
 * none yet. Nothing else changes shape.
 */
export function migrateV3(v3: SnapshotV3): Snapshot {
  return { ...v3, blocks: [], placements: [] }
}

function migrateTask(raw: Record<string, unknown>): Task {
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : []
  return {
    ...(raw as unknown as Task),
    tags: tags.filter((t) => t !== ARCHIVED_TAG),
    archived: raw.archived === true || tags.includes(ARCHIVED_TAG),
    spaceId: typeof raw.spaceId === 'string' ? raw.spaceId : DEFAULT_SPACE_ID,
    pinned: raw.pinned === true,
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
