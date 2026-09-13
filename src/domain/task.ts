// Core task model. Keep this file free of UI / storage concerns —
// every view and every storage adapter depends on it, nothing here depends on them.

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
