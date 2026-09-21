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

/** One line of a Task's Checklist (PD-3). Flat and ordered; ids so items can be toggled from anywhere (E3). */
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const
export type RepeatUnit = (typeof REPEAT_UNITS)[number]

/**
 * PD-4: the Task comes back every `every` units, counted from its Due date or from
 * the day it was finished. A repeating Task always has a Due date.
 */
export interface Repeat {
  every: number
  unit: RepeatUnit
  from: 'due' | 'done'
}

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
  /** PD-1: how long one sitting is expected to take, in minutes, a multiple of 15. Never summed. */
  estimate?: number
  /** PD-3. Absent and empty mean the same. */
  checklist?: ChecklistItem[]
  /** PD-4. Requires `due`. */
  repeat?: Repeat
  createdAt: ISODateTime
  updatedAt: ISODateTime
  completedAt?: ISODateTime
}

/** The Estimate chips (PD-1), in minutes. */
export const ESTIMATE_CHOICES: readonly number[] = [15, 30, 45, 60, 90, 120, 180, 240]

/** Minutes to "45m", "1h", "1h30". */
export function describeEstimate(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** "Every day", "Every 2 weeks", "Every month after done". */
export function describeRepeat(repeat: Repeat): string {
  const unit = repeat.every === 1 ? repeat.unit : `${repeat.every} ${repeat.unit}s`
  return `Every ${unit}${repeat.from === 'done' ? ' after done' : ''}`
}

export const checklistProgress = (items?: readonly ChecklistItem[]): { done: number; total: number } => ({
  done: items?.filter((i) => i.done).length ?? 0,
  total: items?.length ?? 0,
})

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
    ...(input.estimate !== undefined && { estimate: input.estimate }),
    ...(input.checklist !== undefined && input.checklist.length > 0 && { checklist: input.checklist }),
    ...(input.repeat !== undefined && { repeat: input.repeat }),
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

// ---- Repeat (PD-4, PD-5) ---------------------------------------------------------
// Calendar arithmetic on ISODate strings, stepped in UTC like domain/block.ts so a DST
// change can never move a date. A month step clamps the day (31 Jan → 28/29 Feb).

function addInterval(date: ISODate, repeat: Repeat): ISODate {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d))
  switch (repeat.unit) {
    case 'day':
      at.setUTCDate(at.getUTCDate() + repeat.every)
      break
    case 'week':
      at.setUTCDate(at.getUTCDate() + 7 * repeat.every)
      break
    case 'month':
    case 'year': {
      const months = repeat.unit === 'month' ? repeat.every : 12 * repeat.every
      const target = new Date(Date.UTC(y, m - 1 + months, 1))
      const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
      target.setUTCDate(Math.min(d, last))
      return target.toISOString().slice(0, 10)
    }
  }
  return at.toISOString().slice(0, 10)
}

/**
 * The Due date of the next occurrence (PD-5). Due-anchored: the old Due stepped by the
 * interval until it is after `doneOn`, so a Task finished months late comes back once,
 * not once per missed interval. Done-anchored: `doneOn` stepped once.
 */
export function nextDue(repeat: Repeat, due: ISODate, doneOn: ISODate): ISODate {
  if (repeat.from === 'done') return addInterval(doneOn, repeat)
  let next = addInterval(due, repeat)
  while (next <= doneOn) next = addInterval(next, repeat)
  return next
}

/**
 * PD-5, E5: finishing a Task that repeats. `done` is the Task completed as `applyPatch`
 * would (its Repeat removed, so reopening it makes an ordinary Task); `next` is the new
 * occurrence — same title, description, Priority, Tags, Space, Estimate, Repeat and
 * Checklist (unticked), pinned as the finished one was, unscheduled, at the top of To do,
 * due on the next occurrence. The caller stores both.
 */
export function completeRepeating(
  task: Task & { repeat: Repeat },
  tasks: readonly Task[],
  nextId: string,
  now: ISODateTime,
  today: ISODate,
): { done: Task; next: Task } {
  const { repeat: _rule, ...rest } = task
  const done = applyPatch(rest, { status: 'done' }, now)
  const next = buildTask(
    {
      title: task.title,
      description: task.description,
      priority: task.priority,
      tags: task.tags,
      spaceId: task.spaceId,
      pinned: task.pinned,
      due: nextDue(task.repeat, task.due ?? today, today),
      estimate: task.estimate,
      checklist: task.checklist?.map((i) => ({ ...i, done: false })),
      repeat: task.repeat,
    },
    nextId,
    tasks,
    now,
  )
  return { done, next }
}

/** Whether `patch` finishes a Task that will come back (PD-5): the store and the tools ask this before `applyPatch`. */
export const finishesRepeating = (task: Task, patch: TaskPatch): task is Task & { repeat: Repeat } =>
  task.repeat !== undefined && patch.status === 'done' && task.status !== 'done'
