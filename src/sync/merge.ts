// The sync model, in one place: every Task, Space, Routine and Check-in is a row
// keyed by (kind, id) with an `updatedAt`; a deletion is the same row with
// `deleted: true` and `updatedAt` = when it was deleted. Newer `updatedAt` wins,
// whichever Device it came from (ADR 0001). The server applies exactly this rule.
import type { ISODateTime, Task } from '../domain/task'
import { DEFAULT_SPACE_ID, defaultSpace, type Space } from '../domain/space'
import { checkInId, type CheckIn, type RoutineRecord } from '../domain/routine'
import type { RowKind, Tombstone } from '../store/tombstones'
import type { Snapshot } from '../store/repository'

export interface SyncRow {
  kind: RowKind
  id: string
  updatedAt: ISODateTime
  deleted: boolean
  /** The record itself; `null` when deleted. */
  data: unknown
}

export const rowKey = (row: { kind: RowKind; id: string }) => `${row.kind}:${row.id}`

/** Every record on this Device as rows, tombstones included. */
export function toRows(snapshot: Snapshot): SyncRow[] {
  const live = (kind: RowKind, id: string, updatedAt: ISODateTime, data: unknown): SyncRow => ({
    kind,
    id,
    updatedAt,
    deleted: false,
    data,
  })
  return [
    ...snapshot.spaces.map((s) => live('space', s.id, s.updatedAt, s)),
    ...snapshot.tasks.map((t) => live('task', t.id, t.updatedAt, t)),
    ...snapshot.routines.map((r) => live('routine', r.id, r.updatedAt, r)),
    ...snapshot.checkIns.map((c) => live('checkin', checkInId(c.routineId, c.date), c.updatedAt, c)),
    ...snapshot.tombstones.map((t) => ({ kind: t.kind, id: t.id, updatedAt: t.deletedAt, deleted: true, data: null })),
  ]
}

/**
 * Newest wins per (kind, id). On an exact tie the local row is kept, so a
 * round-trip of unchanged data is a no-op.
 */
export function mergeRows(local: SyncRow[], incoming: SyncRow[]): SyncRow[] {
  const merged = new Map(local.map((row) => [rowKey(row), row]))
  for (const row of incoming) {
    const key = rowKey(row)
    const current = merged.get(key)
    if (!current || row.updatedAt > current.updatedAt) merged.set(key, row)
  }
  return [...merged.values()]
}

/**
 * Rows back into a Snapshot, repairing what independent edits can leave behind:
 * a Task whose Space was deleted elsewhere moves to Personal, Check-ins of a
 * deleted Routine go with it, and Personal itself can never be deleted.
 */
export function fromRows(rows: SyncRow[]): Snapshot {
  const tasks: Task[] = []
  const spaces: Space[] = []
  const routines: RoutineRecord[] = []
  const checkIns: CheckIn[] = []
  const tombstones: Tombstone[] = []

  for (const row of rows) {
    if (row.deleted) {
      if (!(row.kind === 'space' && row.id === DEFAULT_SPACE_ID)) {
        tombstones.push({ kind: row.kind, id: row.id, deletedAt: row.updatedAt })
      }
      continue
    }
    switch (row.kind) {
      case 'task':
        tasks.push(row.data as Task)
        break
      case 'space':
        spaces.push(row.data as Space)
        break
      case 'routine':
        routines.push(row.data as RoutineRecord)
        break
      case 'checkin':
        checkIns.push(row.data as CheckIn)
        break
    }
  }

  if (!spaces.some((s) => s.id === DEFAULT_SPACE_ID)) spaces.push(defaultSpace())
  const spaceIds = new Set(spaces.map((s) => s.id))
  const routineIds = new Set(routines.map((r) => r.id))

  return {
    tasks: tasks.map((t) => (spaceIds.has(t.spaceId) ? t : { ...t, spaceId: DEFAULT_SPACE_ID })),
    spaces,
    routines,
    checkIns: checkIns.filter((c) => routineIds.has(c.routineId)),
    tombstones,
  }
}

/** What the local Snapshot becomes once the server's changes are folded in. */
export const applyRemote = (local: Snapshot, incoming: SyncRow[]): Snapshot =>
  fromRows(mergeRows(toRows(local), incoming))
