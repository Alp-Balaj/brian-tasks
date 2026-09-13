import type { Task } from '../domain/task'
import { DEFAULT_SPACE_ID, defaultSpace } from '../domain/space'
import type { Snapshot } from './repository'

const ARCHIVED_TAG = 'archived'

/**
 * v1 → v2. v1 was a bare `Task[]` with no spaces, no routines, and "archived"
 * expressed as a tag. Every task lands in the default space, unpinned; the tag
 * becomes the `archived` flag and is removed (Q5, Q31). The seed goes through
 * this too, so it is tolerant of fields already being present.
 */
export function migrateV1(tasks: unknown[]): Snapshot {
  return {
    tasks: tasks.filter(isRecord).map(migrateTask),
    spaces: [defaultSpace()],
    routines: [],
  }
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
