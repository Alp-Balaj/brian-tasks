// Time blocks. A Block is a named, coloured span of one day on the Week page; a
// Placement is a Task put on a day, inside a Block and/or at an hour. Standing blocks
// are versioned rules keyed by week (ADR 0003), not copies per week. Types first,
// pure functions below. No UI / storage imports: the sync server imports this file
// too, so relative imports carry their .ts extension.
import { PRIORITY_RANK, type ISODate, type ISODateTime, type Task } from './task.ts'
import { WEEKDAYS_MONDAY_FIRST, type Weekday } from './routine.ts'

/** ISODate of a Monday. Sorts like ISODate (D6). */
export type WeekKey = ISODate
/** Minutes from midnight, 0..1440, multiple of STEP (D5). */
export type Minutes = number
export const STEP = 15
export const DAY = 1440

export interface Block {
  id: string
  name: string
  /** One of BLOCK_COLOURS (D11). */
  colour: string
  weekday: Weekday
  start: Minutes
  /** start < end <= DAY; a block lives inside one day (TB-7). */
  end: Minutes
  /** First week this version applies to (D1). */
  from: WeekKey
  /** First week it no longer applies to (exclusive). undefined = carries to every next week (D2). */
  until?: WeekKey
  /** Routines done in this block. Carry with the block (TB-9, D4). */
  routineIds: string[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/**
 * A Task on a day (D3). `blockId` = "sometime during this block" (TB-8); `start`/`end`
 * = drawn at this hour (TB-11, TB-12). At least one of the two is set — a placement
 * with neither is deleted. Per date, so a Task link never carries to another week
 * (TB-9) and the same Task can be placed any number of times (TB-14).
 */
export interface Placement {
  id: string
  taskId: string
  date: ISODate
  blockId?: string
  start?: Minutes
  end?: Minutes
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** `week` is the first week the block applies to; `carry` off (the default, TB-4) makes it one-off (D2). */
export type NewBlock = Pick<Block, 'name' | 'colour' | 'weekday' | 'start' | 'end'> &
  Partial<Pick<Block, 'routineIds'>> & { week: WeekKey; carry?: boolean }
export type BlockPatch = Partial<Pick<Block, 'name' | 'colour' | 'weekday' | 'start' | 'end' | 'routineIds'>>
export type NewPlacement = Pick<Placement, 'taskId' | 'date'> & Partial<Pick<Placement, 'blockId' | 'start' | 'end'>>
export type PlacementPatch = Partial<Pick<Placement, 'date' | 'blockId' | 'start' | 'end'>>

// ---- Palette (D11) -------------------------------------------------------------
// Twelve named colours that read on both themes as filled bars with white text.
// Stored as hex like Spaces; free hex is out (TB-3).

export const BLOCK_COLOUR_NAMES = {
  slate: '#64748b',
  red: '#dc4c4c',
  orange: '#e0823a',
  amber: '#d9a428',
  lime: '#7fa83a',
  green: '#2f9e6a',
  teal: '#2aa1a8',
  sky: '#3b8fd6',
  blue: '#4f6fd8',
  violet: '#7d5fd3',
  pink: '#d65a9e',
  brown: '#9a6b4f',
} as const

export type BlockColourName = keyof typeof BLOCK_COLOUR_NAMES

/** The palette as hex values, in picker order. */
export const BLOCK_COLOURS: readonly string[] = Object.values(BLOCK_COLOUR_NAMES)

/**
 * The legend and the name autocomplete (TB-3): each distinct name once, with the
 * colour of the most recently updated block of that name. Sorted by name.
 */
export function blockNames(blocks: readonly Block[]): { name: string; colour: string }[] {
  const latest = new Map<string, Block>()
  for (const b of blocks) {
    const seen = latest.get(b.name)
    if (!seen || b.updatedAt > seen.updatedAt) latest.set(b.name, b)
  }
  return [...latest.values()]
    .map(({ name, colour }) => ({ name, colour }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** First palette colour no block *name* uses yet, so a new name is tellable apart by default. */
export function nextFreeBlockColour(blocks: readonly Block[]): string {
  const used = new Set(blockNames(blocks).map((n) => n.colour))
  return BLOCK_COLOURS.find((c) => !used.has(c)) ?? BLOCK_COLOURS[0]
}

// ---- Weeks and days --------------------------------------------------------------
// Calendar arithmetic on ISODate strings only. Dates are stepped in UTC so that a
// DST change can never move a day; the result is always a calendar date, never a
// moment, so the Device's timezone does not come into it.

const parse = (iso: ISODate): Date => new Date(`${iso}T00:00:00Z`)
const toISO = (d: Date): ISODate => d.toISOString().slice(0, 10)

/** `date` shifted by `days` calendar days. */
export function shiftDate(date: ISODate, days: number): ISODate {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

/** date-fns getDay() convention, like Routine schedules: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: ISODate): Weekday {
  return parse(date).getUTCDay() as Weekday
}

/** Monday of the week `date` falls in (TB-1, D6). */
export function weekOf(date: ISODate): WeekKey {
  return shiftDate(date, -((weekdayOf(date) + 6) % 7))
}

/** The 7 dates of a week, Monday first. */
export function weekDays(week: WeekKey): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(week, i))
}

/** The Monday after `week`. */
export const nextWeek = (week: WeekKey): WeekKey => shiftDate(week, 7)

/** The date in `week` that falls on `weekday`. */
export const dateInWeek = (week: WeekKey, weekday: Weekday): ISODate =>
  shiftDate(week, WEEKDAYS_MONDAY_FIRST.indexOf(weekday))

// ---- Blocks ------------------------------------------------------------------------

/** Whether this version of the block is in force in `week` (D1, D2). */
export function appliesTo(block: Block, week: WeekKey): boolean {
  return block.from <= week && (block.until === undefined || week < block.until)
}

/** Carry to next week is on (TB-4): the rule has no end (D2). */
export const carries = (block: Block): boolean => block.until === undefined

const byWeekdayThenStart = (a: Block, b: Block) =>
  WEEKDAYS_MONDAY_FIRST.indexOf(a.weekday) - WEEKDAYS_MONDAY_FIRST.indexOf(b.weekday) || byStart(a, b)

const byStart = (a: { start: Minutes; end: Minutes }, b: { start: Minutes; end: Minutes }) =>
  a.start - b.start || a.end - b.end

/** Every block version in force in `week`, Monday first, then by start. */
export function blocksInWeek(blocks: readonly Block[], week: WeekKey): Block[] {
  return blocks.filter((b) => appliesTo(b, week)).sort(byWeekdayThenStart)
}

/** The blocks drawn on one day, by start. */
export function blocksOn(blocks: readonly Block[], date: ISODate): Block[] {
  const week = weekOf(date)
  const weekday = weekdayOf(date)
  return blocks.filter((b) => b.weekday === weekday && appliesTo(b, week)).sort(byStart)
}

/**
 * TB-5, D8: cut a standing block at `week` so that an edit from this week on leaves
 * past weeks as they were. The past version keeps the id and ends at `week`; the
 * future version starts at `week` under `futureId` (the caller generates ids, as
 * with `buildTask`). Placements from `week` on are the store's to re-point.
 */
export function splitAt(block: Block, week: WeekKey, now: ISODateTime, futureId: string): { past: Block; future: Block } {
  return {
    past: { ...block, until: week, updatedAt: now },
    future: { ...block, id: futureId, from: week, createdAt: now, updatedAt: now },
  }
}

/** Whether two spans share any time. Touching ends (08:00–09:00, 09:00–10:00) do not overlap. */
export function overlaps(a: { start: Minutes; end: Minutes }, b: { start: Minutes; end: Minutes }): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * The parts of the day where two or more of `items` coincide, as disjoint spans by
 * start — the hatch layer draws these (TB-6, TB-12). Union of the pairwise
 * intersections; adjacent regions are merged.
 */
export function overlapRegions(items: readonly { start: Minutes; end: Minutes }[]): { start: Minutes; end: Minutes }[] {
  const pieces: { start: Minutes; end: Minutes }[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) {
        pieces.push({ start: Math.max(items[i].start, items[j].start), end: Math.min(items[i].end, items[j].end) })
      }
    }
  }
  pieces.sort(byStart)
  const merged: { start: Minutes; end: Minutes }[] = []
  for (const piece of pieces) {
    const last = merged[merged.length - 1]
    if (last && piece.start <= last.end) last.end = Math.max(last.end, piece.end)
    else merged.push({ ...piece })
  }
  return merged
}

/** The block under way at `nowMinutes` on `date`: first by start with start <= now < end. A block that ends now is over. */
export function currentBlock(blocks: readonly Block[], date: ISODate, nowMinutes: Minutes): Block | undefined {
  return blocksOn(blocks, date).find((b) => b.start <= nowMinutes && nowMinutes < b.end)
}

// ---- Placements ------------------------------------------------------------------

/** Drawn at an hour (TB-12): both ends set. */
export const isTimed = (p: Placement): p is Placement & { start: Minutes; end: Minutes } =>
  p.start !== undefined && p.end !== undefined

/** The placements on one day: timed ones by start, then the untimed ones. */
export function placementsOn(placements: readonly Placement[], date: ISODate): Placement[] {
  return placements.filter((p) => p.date === date).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity))
}

/** The placements inside `block` on `date` — the block sheet's Tasks list (TB-10). */
export function placementsIn(placements: readonly Placement[], block: Block, date: ISODate): Placement[] {
  return placementsOn(placements, date).filter((p) => p.blockId === block.id)
}

/** The days a Task is placed on, sorted and unique (TB-18). */
export function placedDays(placements: readonly Placement[], taskId: string): ISODate[] {
  return [...new Set(placements.filter((p) => p.taskId === taskId).map((p) => p.date))].sort()
}

/** TB-15, D9: the earliest day the Task is placed on, or undefined when it is not placed at all. */
export function scheduledFromPlacements(task: Task, placements: readonly Placement[]): ISODate | undefined {
  return placedDays(placements, task.id)[0]
}

const byPriority = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)

/** Live = still needs you: not archived, not done. */
const isLive = (task: Task) => !task.archived && task.status !== 'done'

/** The day's tray (TB-18): live Tasks Scheduled on `date` with no placement on it, by priority. */
export function unplacedOn(tasks: readonly Task[], placements: readonly Placement[], date: ISODate): Task[] {
  const placed = new Set(placementsOn(placements, date).map((p) => p.taskId))
  return tasks.filter((t) => t.scheduled === date && isLive(t) && !placed.has(t.id)).sort(byPriority)
}

/**
 * TB-17: the Task was re-Scheduled from the editor to a day it is not placed on, so
 * this placement is where it *was* going to happen. Shown as a mismatch hint.
 */
export function isStalePlacement(p: Placement, task: Task, placements: readonly Placement[]): boolean {
  if (task.scheduled === undefined || task.scheduled === p.date) return false
  return !placedDays(placements, task.id).includes(task.scheduled)
}

// ---- Time -------------------------------------------------------------------------

/** "06:00", "17:30", "24:00". */
export function describeMinutes(m: Minutes): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** "06:00–07:45". */
export const describeSpan = (start: Minutes, end: Minutes): string =>
  `${describeMinutes(start)}–${describeMinutes(end)}`

/** Nearest STEP, kept inside the day (D5). */
export function snap(m: Minutes): Minutes {
  return Math.min(DAY, Math.max(0, Math.round(m / STEP) * STEP))
}
