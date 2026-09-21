// The week look-back (PD-12, E11): what a week came to, drawn not scored. Pure, so the
// Week page's header and the MCP `week_review` tool report the same numbers. No UI or
// storage imports; the server imports this file, so relative imports carry `.ts`.
import type { ISODate, Task } from './task.ts'
import { isScheduledOn, type Routine } from './routine.ts'
import { blocksInWeek, isTimed, placementsOn, weekDays, type Block, type Placement, type WeekKey } from './block.ts'

export interface WeekReview {
  week: WeekKey
  /** Tasks completed on a day of the week, grouped by Space id, most recent first inside each. */
  done: { spaceId: string; tasks: Task[] }[]
  doneCount: number
  /** Each live Routine's Check-ins over its scheduled days in the week up to `today`. */
  routines: { routine: Routine; checked: number; scheduled: number }[]
  checked: number
  scheduled: number
  /** Placements on a past day of the week whose Task is not done: the mark that was not honoured (TB-16). */
  stale: { placement: Placement; task: Task; block?: Block }[]
}

/** Midnight of an ISO date in local time, for the weekday functions the Routine domain uses. */
const localDate = (date: ISODate): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function weekReview(
  tasks: readonly Task[],
  routines: readonly Routine[],
  blocks: readonly Block[],
  placements: readonly Placement[],
  week: WeekKey,
  today: ISODate,
): WeekReview {
  const days = weekDays(week)
  const first = days[0]
  const last = days[6]
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const done = new Map<string, Task[]>()
  for (const t of tasks) {
    const on = t.completedAt?.slice(0, 10)
    if (t.status !== 'done' || !on || on < first || on > last) continue
    const list = done.get(t.spaceId) ?? []
    list.push(t)
    done.set(t.spaceId, list)
  }
  for (const list of done.values()) list.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
  const doneGroups = [...done.entries()].map(([spaceId, list]) => ({ spaceId, tasks: list }))

  const soFar = days.filter((d) => d <= today)
  const routineRows = routines
    .filter((r) => !r.archived)
    .map((routine) => {
      const scheduledDays = soFar.filter((d) => isScheduledOn(routine.schedule, localDate(d)))
      return {
        routine,
        scheduled: scheduledDays.length,
        checked: scheduledDays.filter((d) => routine.checkIns.includes(d)).length,
      }
    })
    .filter((r) => r.scheduled > 0)

  const inForce = blocksInWeek(blocks, week)
  const stale: WeekReview['stale'] = []
  for (const date of days.filter((d) => d < today)) {
    for (const placement of placementsOn(placements, date)) {
      const task = byId.get(placement.taskId)
      if (!task || task.status === 'done' || task.archived) continue
      const block = placement.blockId ? inForce.find((b) => b.id === placement.blockId) : undefined
      // An untimed placement whose block is gone draws nothing, so there is nothing to honour.
      if (!isTimed(placement) && !block) continue
      stale.push({ placement, task, block })
    }
  }

  return {
    week,
    done: doneGroups,
    doneCount: doneGroups.reduce((n, g) => n + g.tasks.length, 0),
    routines: routineRows,
    checked: routineRows.reduce((n, r) => n + r.checked, 0),
    scheduled: routineRows.reduce((n, r) => n + r.scheduled, 0),
    stale,
  }
}

/** "12 done · Routines 9/14 · 2 stale", with quiet parts left out. */
export function describeReview(r: WeekReview): string {
  const parts = [`${r.doneCount} done`]
  if (r.scheduled > 0) parts.push(`Routines ${r.checked}/${r.scheduled}`)
  if (r.stale.length > 0) parts.push(`${r.stale.length} stale`)
  return parts.join(' · ')
}
