// Core task model. Keep this file free of UI / storage concerns —
// every view and every storage adapter depends on it, nothing here depends on them.
// The sync server imports this file too (server/ runs it under Node directly), so
// relative imports inside src/domain carry their .ts extension.
import { DEFAULT_SPACE_ID } from './space.ts'

export const TASK_STATUSES = ['todo', 'in-progress', 'hold', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** Calendar date as YYYY-MM-DD (no time, no timezone). */
export type ISODate = string
/** Full timestamp as ISO 8601. */
export type ISODateTime = string

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  /** Hard deadline. Drives the calendar. */
  due?: ISODate
  /** When you intend to work on it. Also shown on the calendar. */
  scheduled?: ISODate
  /** Manual ordering inside a kanban column (lower = higher up). */
  order: number
  /** The one Space this task lives in. Always set; DEFAULT_SPACE_ID after migration. */
  spaceId: string
  /** Deliberately put out of sight. Hidden from every view except Archive, regardless of status. */
  archived: boolean
  /** Hand-picked to appear on Home. Cleared when the task becomes done. */
  pinned: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
  completedAt?: ISODateTime
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  hold: 'On hold',
  done: 'Done',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }
export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value)
}

// ---- Construction and patching -------------------------------------------------
// The one place the defaults and side rules live. The app's store and the server's
// MCP tools both go through these, so a Task made from a chat looks exactly like one
// made from Quick Add.

/**
 * A complete Task from what the caller gave. `order` puts it at the top of its
 * Status column among `tasks` (siblings in other columns are ignored). A Task born
 * `done` is completed now and can never be pinned (Q25).
 */
export function buildTask(input: NewTask, id: string, tasks: readonly Task[], now: ISODateTime): Task {
  const status = input.status ?? 'todo'
  const siblings = tasks.filter((t) => t.status === status)
  return {
    id,
    title: input.title.trim(),
    description: input.description ?? '',
    status,
    priority: input.priority ?? 'normal',
    tags: input.tags ?? [],
    due: input.due,
    scheduled: input.scheduled,
    order: input.order ?? Math.min(0, ...siblings.map((t) => t.order)) - 1,
    spaceId: input.spaceId ?? DEFAULT_SPACE_ID,
    archived: input.archived ?? false,
    pinned: status === 'done' ? false : (input.pinned ?? false),
    createdAt: now,
    updatedAt: now,
    completedAt: status === 'done' ? now : undefined,
  }
}

/**
 * `task` with `patch` applied and `updatedAt` bumped. Entering `done` records
 * `completedAt`, leaving it clears it, and a done Task is never pinned (Q25).
 */
export function applyPatch(task: Task, patch: TaskPatch, now: ISODateTime): Task {
  const next: Task = { ...task, ...patch, updatedAt: now }
  if (patch.status && patch.status !== task.status) {
    next.completedAt = patch.status === 'done' ? now : undefined
  }
  if (next.status === 'done') next.pinned = false
  return next
}
