// Routine model. A Routine is never finished — only done-for-today (a Check-in) or not.
// It never appears on the Board, List or Calendar. Types first, pure functions below.
import { getDay, startOfDay, subDays } from 'date-fns'
import type { ISODate, ISODateTime } from './task.ts'
import { toISODate } from '../lib/dates.ts'

/** date-fns getDay(): 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** The days a Routine is expected: every day, or a chosen set of weekdays. */
export type Schedule = { kind: 'daily' } | { kind: 'weekdays'; days: Weekday[] }

export interface Routine {
  id: string
  title: string
  schedule: Schedule
  /** Free text, e.g. "currently: Peak". */
  note: string
  archived: boolean
  /**
   * Days with a Check-in. Sorted ascending, unique. Derived by the store from
   * the CheckIn records — change it through `checkIn` / `uncheck`, never here.
   */
  checkIns: ISODate[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** A Routine as stored and synced: the Check-ins live in their own records. */
export type RoutineRecord = Omit<Routine, 'checkIns'>

/**
 * The record that a Routine was done on one day. A fact about that day, not an
 * edit to the Routine, so Devices merge Check-ins as a union: one made anywhere
 * stays made everywhere until explicitly unchecked.
 */
export interface CheckIn {
  routineId: string
  date: ISODate
  updatedAt: ISODateTime
}

export const checkInId = (routineId: string, date: ISODate) => `${routineId}:${date}`

export type NewRoutine = Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'checkIns'>> & { title: string }
export type RoutinePatch = Partial<Omit<Routine, 'id' | 'createdAt' | 'checkIns'>>

// ---- Pure functions (S2) -------------------------------------------------------
// All date arithmetic below runs on local calendar days. `Date` values are only used
// for "which weekday is this" and for stepping backwards; comparisons use ISODate
// strings, which sort lexicographically.

export function isScheduledOn(schedule: Schedule, date: Date): boolean {
  if (schedule.kind === 'daily') return true
  return schedule.days.includes(getDay(date) as Weekday)
}

export function hasCheckIn(routine: Routine, date: ISODate): boolean {
  return routine.checkIns.includes(date)
}

/**
 * Q9/Q22: consecutive scheduled days with a Check-in, ending today or yesterday.
 * Unscheduled days are skipped — they neither extend nor break the streak.
 * Today without a Check-in does not break it (the day is not over yet); the first
 * *past* scheduled day without a Check-in does.
 */
export function currentStreak(routine: Routine, today: Date): number {
  const earliest = routine.checkIns[0]
  if (!earliest) return 0
  const todayISO = toISODate(today)

  let streak = 0
  let day = startOfDay(today)
  // Walking further back than the first Check-in can only ever find misses (or an
  // unscheduled-forever schedule), so that is where we stop.
  while (toISODate(day) >= earliest) {
    const iso = toISODate(day)
    if (isScheduledOn(routine.schedule, day)) {
      if (hasCheckIn(routine, iso)) streak++
      else if (iso !== todayISO) break
    }
    day = subDays(day, 1)
  }
  return streak
}

/** Missed = scheduled, already in the past, and no Check-in. Today is never missed. */
export function isMissed(routine: Routine, date: Date, today: Date): boolean {
  const iso = toISODate(date)
  return iso < toISODate(today) && isScheduledOn(routine.schedule, date) && !hasCheckIn(routine, iso)
}

/** Monday-first, matching the calendar grid. */
export const WEEKDAYS_MONDAY_FIRST: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

/** "Every day", "Mon, Wed, Fri", "Never" — for rows and the Archive page. */
export function describeSchedule(schedule: Schedule): string {
  if (schedule.kind === 'daily') return 'Every day'
  if (schedule.days.length === 0) return 'Never'
  if (schedule.days.length === 7) return 'Every day'
  return WEEKDAYS_MONDAY_FIRST.filter((d) => schedule.days.includes(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(', ')
}
