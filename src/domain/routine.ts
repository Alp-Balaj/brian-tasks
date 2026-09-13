// Routine model. A Routine is never finished — only done-for-today (a Check-in) or not.
// It never appears on the Board, List or Calendar. Types only here; the pure functions
// (isScheduledOn, hasCheckIn, currentStreak, isMissed) are added below by S2.
import type { ISODate, ISODateTime } from './task'

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
  /** Days with a Check-in. Sorted ascending, unique. */
  checkIns: ISODate[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type NewRoutine = Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }
export type RoutinePatch = Partial<Omit<Routine, 'id' | 'createdAt'>>
