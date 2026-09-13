// Pure selectors for Home. Home reads every non-archived task across every Space (Q3),
// so callers pass `useTasks().tasks` here rather than `useVisibleTasks()`.
import { PRIORITY_RANK, type ISODate, type Task } from '../../domain/task'

/** Why a task is in the Today section. `overdue` wins over the other two. */
export type TodayReason = 'overdue' | 'due today' | 'scheduled'

export interface TodayRow {
  task: Task
  reason: TodayReason
}

export interface HomeSections {
  pinned: Task[]
  today: TodayRow[]
  inProgress: Task[]
}

const byPriority = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)

const REASON_RANK: Record<TodayReason, number> = { overdue: 0, 'due today': 1, scheduled: 2 }

export function todayReason(task: Task, today: ISODate): TodayReason | null {
  if (task.due && task.due < today && task.status !== 'done') return 'overdue'
  if (task.due === today) return 'due today'
  if (task.scheduled === today) return 'scheduled'
  return null
}

/**
 * Splits tasks into Home's sections. A task may land in more than one section.
 * Archived tasks are dropped here so callers don't have to remember.
 */
export function homeSections(tasks: Task[], today: ISODate): HomeSections {
  const live = tasks.filter((t) => !t.archived)

  const pinned = live.filter((t) => t.pinned && t.status !== 'done').sort(byPriority)

  const todayRows: TodayRow[] = []
  for (const task of live) {
    const reason = todayReason(task, today)
    if (reason) todayRows.push({ task, reason })
  }
  todayRows.sort(
    (a, b) =>
      REASON_RANK[a.reason] - REASON_RANK[b.reason] ||
      (a.task.due ?? '').localeCompare(b.task.due ?? '') ||
      byPriority(a.task, b.task),
  )

  const inProgress = live.filter((t) => t.status === 'in-progress').sort(byPriority)

  return { pinned, today: todayRows, inProgress }
}
