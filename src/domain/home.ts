// Pure selectors for Home. Home reads every non-archived task across every Space (Q3),
// so callers pass `useTasks().tasks` here rather than `useVisibleTasks()`.
import { PRIORITY_RANK, type ISODate, type Task } from './task.ts'

/** Why a task is in the Today section. */
export type TodayReason = 'due today' | 'scheduled'

export interface TodayRow {
  task: Task
  reason: TodayReason
}

export interface HomeSections {
  /** Past their Due date and not done. The first thing Home shows. */
  overdue: Task[]
  today: TodayRow[]
  pinned: Task[]
  inProgress: Task[]
}

const byPriority = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)

const REASON_RANK: Record<TodayReason, number> = { 'due today': 0, scheduled: 1 }

export const isOverdue = (task: Task, today: ISODate) => !!task.due && task.due < today && task.status !== 'done'

export function todayReason(task: Task, today: ISODate): TodayReason | null {
  if (task.due === today) return 'due today'
  if (task.scheduled === today) return 'scheduled'
  return null
}

/**
 * Splits tasks into Home's sections. Each task appears once, in the first section it
 * qualifies for: Overdue, Today, Pinned, In progress. Done and archived tasks are left
 * out — Home is about what still needs you.
 */
export function homeSections(tasks: Task[], today: ISODate): HomeSections {
  const live = tasks.filter((t) => !t.archived && t.status !== 'done')

  const overdue: Task[] = []
  const todayRows: TodayRow[] = []
  const pinned: Task[] = []
  const inProgress: Task[] = []

  for (const task of live) {
    if (isOverdue(task, today)) {
      overdue.push(task)
      continue
    }
    const reason = todayReason(task, today)
    if (reason) {
      todayRows.push({ task, reason })
      continue
    }
    if (task.pinned) {
      pinned.push(task)
      continue
    }
    if (task.status === 'in-progress') inProgress.push(task)
  }

  // Oldest deadline first: the most overdue thing is the most pressing.
  overdue.sort((a, b) => a.due!.localeCompare(b.due!) || byPriority(a, b))
  todayRows.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || byPriority(a.task, b.task))
  pinned.sort(byPriority)
  inProgress.sort(byPriority)

  return { overdue, today: todayRows, pinned, inProgress }
}
