import { describe, expect, it } from 'vitest'
import {
  BLOCK_COLOURS,
  DAY,
  appliesTo,
  blockNames,
  blocksInWeek,
  blocksOn,
  carries,
  currentBlock,
  dateInWeek,
  describeMinutes,
  describeSpan,
  isStalePlacement,
  isTimed,
  nextFreeBlockColour,
  nextWeek,
  overlapRegions,
  overlaps,
  placedDays,
  placementsIn,
  placementsOn,
  scheduledFromPlacements,
  shiftDate,
  snap,
  splitAt,
  unplacedOn,
  weekDays,
  weekOf,
  weekdayOf,
  type Block,
  type Placement,
} from './block'
import { DEFAULT_SPACE_ID } from './space'
import type { Task } from './task'

// Weeks used throughout: W0 = Mon 2026-09-14 … Sun 2026-09-20, W1 = Mon 2026-09-21, W2 = Mon 2026-09-28.
const W0 = '2026-09-14'
const W1 = '2026-09-21'
const W2 = '2026-09-28'
const WED0 = '2026-09-16'
const SAT0 = '2026-09-19'
const SUN0 = '2026-09-20'
const WED1 = '2026-09-23'

const T = (n: number) => `2026-09-01T10:00:${String(n).padStart(2, '0')}.000Z`

const block = (id: string, extra: Partial<Block> = {}): Block => ({
  id,
  name: 'Job',
  colour: BLOCK_COLOURS[0],
  weekday: 3, // Wednesday
  start: 540,
  end: 1020,
  from: W0,
  routineIds: [],
  createdAt: T(0),
  updatedAt: T(0),
  ...extra,
})

const placement = (id: string, taskId: string, date: string, extra: Partial<Placement> = {}): Placement => ({
  id,
  taskId,
  date,
  createdAt: T(0),
  updatedAt: T(0),
  ...extra,
})

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: '',
  status: 'todo',
  priority: 'normal',
  tags: [],
  order: 0,
  spaceId: DEFAULT_SPACE_ID,
  archived: false,
  pinned: false,
  createdAt: T(0),
  updatedAt: T(0),
  ...extra,
})

describe('weeks and days', () => {
  it('weekOf is the Monday of the week, for every day of it', () => {
    for (const d of weekDays(W0)) expect(weekOf(d)).toBe(W0)
    expect(weekOf(SUN0)).toBe(W0)
    expect(weekOf(W1)).toBe(W1)
  })
  it('weekDays lists the seven dates Monday first', () => {
    expect(weekDays(W0)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })
  it('weekdayOf uses the date-fns convention (0 = Sunday)', () => {
    expect(weekdayOf(W0)).toBe(1)
    expect(weekdayOf(SAT0)).toBe(6)
    expect(weekdayOf(SUN0)).toBe(0)
  })
  it('nextWeek is seven days on', () => {
    expect(nextWeek(W0)).toBe(W1)
    expect(nextWeek(W1)).toBe(W2)
  })
  it('shiftDate crosses month and year ends', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('dateInWeek maps a weekday into the week', () => {
    expect(dateInWeek(W0, 3)).toBe(WED0)
    expect(dateInWeek(W0, 0)).toBe(SUN0)
  })
})

describe('appliesTo — from is inclusive, until exclusive', () => {
  it('a standing block applies from its first week on, never before', () => {
    const b = block('b')
    expect(appliesTo(b, '2026-09-07')).toBe(false)
    expect(appliesTo(b, W0)).toBe(true)
    expect(appliesTo(b, W2)).toBe(true)
  })
  it('a one-off block applies to exactly one week', () => {
    const b = block('b', { until: W1 })
    expect(appliesTo(b, W0)).toBe(true)
    expect(appliesTo(b, W1)).toBe(false)
  })
  it('an ended block stops at until', () => {
    const b = block('b', { until: W2 })
    expect(appliesTo(b, W1)).toBe(true)
    expect(appliesTo(b, W2)).toBe(false)
  })
})

describe('carries', () => {
  it('is on when there is no until (TB-4)', () => {
    expect(carries(block('b'))).toBe(true)
    expect(carries(block('b', { until: W1 }))).toBe(false)
  })
})

describe('blocksInWeek / blocksOn', () => {
  const gym = block('gym', { name: 'Gym', weekday: 1, start: 360, end: 465 })
  const job = block('job', { weekday: 3 })
  const sleep = block('sleep', { name: 'Sleep', weekday: 3, start: 0, end: 360 })
  const later = block('later', { name: 'Later', weekday: 0, from: W1 })
  const all = [job, later, sleep, gym]

  it('blocksInWeek keeps only versions in force, Monday first then by start', () => {
    expect(blocksInWeek(all, W0).map((b) => b.id)).toEqual(['gym', 'sleep', 'job'])
    expect(blocksInWeek(all, W1).map((b) => b.id)).toEqual(['gym', 'sleep', 'job', 'later'])
  })
  it('blocksOn matches weekday and week, sorted by start', () => {
    expect(blocksOn(all, WED0).map((b) => b.id)).toEqual(['sleep', 'job'])
    expect(blocksOn(all, SUN0)).toEqual([])
    expect(blocksOn(all, nextWeek(SUN0)).map((b) => b.id)).toEqual(['later'])
  })
})

describe('splitAt (TB-5, D8)', () => {
  it('past keeps the id and ends at the week; future starts there under the new id', () => {
    const b = block('b', { until: W2 })
    const { past, future } = splitAt(b, W1, T(5), 'fresh')
    expect(past).toEqual({ ...b, until: W1, updatedAt: T(5) })
    expect(future).toEqual({ ...b, id: 'fresh', from: W1, until: W2, createdAt: T(5), updatedAt: T(5) })
    expect(appliesTo(past, W0)).toBe(true)
    expect(appliesTo(past, W1)).toBe(false)
    expect(appliesTo(future, W1)).toBe(true)
  })
  it('a standing block stays standing on the future side', () => {
    const { past, future } = splitAt(block('b'), W1, T(5), 'fresh')
    expect(carries(past)).toBe(false)
    expect(carries(future)).toBe(true)
  })
})

describe('overlaps / overlapRegions', () => {
  it('touching spans do not overlap', () => {
    expect(overlaps({ start: 480, end: 540 }, { start: 540, end: 600 })).toBe(false)
    expect(overlaps({ start: 480, end: 541 }, { start: 540, end: 600 })).toBe(true)
    expect(overlaps({ start: 0, end: 1440 }, { start: 600, end: 601 })).toBe(true)
  })
  it('overlapRegions is the union of pairwise intersections', () => {
    expect(overlapRegions([{ start: 540, end: 1020 }, { start: 960, end: 1080 }])).toEqual([{ start: 960, end: 1020 }])
    expect(overlapRegions([{ start: 540, end: 1020 }, { start: 1020, end: 1080 }])).toEqual([])
    expect(overlapRegions([])).toEqual([])
  })
  it('merges regions that touch or nest, and orders them by start', () => {
    const items = [
      { start: 0, end: 600 },
      { start: 300, end: 900 }, // ∩ first = 300–600
      { start: 600, end: 1200 }, // ∩ second = 600–900
      { start: 1300, end: 1440 },
      { start: 1380, end: 1440 }, // ∩ fourth = 1380–1440
    ]
    expect(overlapRegions(items)).toEqual([
      { start: 300, end: 900 },
      { start: 1380, end: 1440 },
    ])
  })
})

describe('currentBlock', () => {
  const sleep = block('sleep', { name: 'Sleep', weekday: 3, start: 0, end: 360 })
  const job = block('job', { weekday: 3 })
  it('is the block with start <= now < end', () => {
    expect(currentBlock([job, sleep], WED0, 0)?.id).toBe('sleep')
    expect(currentBlock([job, sleep], WED0, 540)?.id).toBe('job')
    expect(currentBlock([job, sleep], WED0, 1019)?.id).toBe('job')
  })
  it('a block that ends now is over', () => {
    expect(currentBlock([job, sleep], WED0, 1020)).toBeUndefined()
    expect(currentBlock([job, sleep], WED0, 360)).toBeUndefined()
  })
  it('only looks at blocks on that day', () => {
    expect(currentBlock([job], SAT0, 600)).toBeUndefined()
    expect(currentBlock([block('old', { weekday: 3, until: W0 })], WED0, 600)).toBeUndefined()
  })
})

describe('placements', () => {
  const job = block('job')
  const inJob = placement('p1', 'a', WED0, { blockId: 'job' })
  const timedInJob = placement('p2', 'b', WED0, { blockId: 'job', start: 960, end: 1020 })
  const free = placement('p3', 'a', WED0, { start: 600, end: 660 })
  const saturday = placement('p4', 'a', SAT0, { start: 600, end: 660 })
  const all = [saturday, inJob, timedInJob, free]

  it('isTimed needs both ends', () => {
    expect(isTimed(inJob)).toBe(false)
    expect(isTimed(free)).toBe(true)
    expect(isTimed(placement('x', 'a', WED0, { start: 600 }))).toBe(false)
  })
  it('placementsOn lists the day, timed first by start', () => {
    expect(placementsOn(all, WED0).map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
    expect(placementsOn(all, SUN0)).toEqual([])
  })
  it('placementsIn is the block on that day', () => {
    expect(placementsIn(all, job, WED0).map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(placementsIn(all, job, WED1)).toEqual([])
  })
  it('placedDays is sorted and unique (TB-14)', () => {
    expect(placedDays(all, 'a')).toEqual([WED0, SAT0])
    expect(placedDays(all, 'none')).toEqual([])
  })
  it('scheduledFromPlacements is the earliest day, or undefined (TB-15)', () => {
    expect(scheduledFromPlacements(task('a'), all)).toBe(WED0)
    expect(scheduledFromPlacements(task('b'), all)).toBe(WED0)
    expect(scheduledFromPlacements(task('c'), all)).toBeUndefined()
  })
})

describe('unplacedOn (TB-18)', () => {
  const placements = [placement('p', 'placed', WED0, { start: 600, end: 660 })]
  it('lists live tasks Scheduled that day with no placement on it, by priority', () => {
    const tasks = [
      task('placed', { scheduled: WED0 }),
      task('low', { scheduled: WED0, priority: 'low' }),
      task('urgent', { scheduled: WED0, priority: 'urgent' }),
      task('other-day', { scheduled: SAT0 }),
      task('done', { scheduled: WED0, status: 'done' }),
      task('archived', { scheduled: WED0, archived: true }),
      task('unscheduled'),
    ]
    expect(unplacedOn(tasks, placements, WED0).map((t) => t.id)).toEqual(['urgent', 'low'])
  })
  it('a task placed on another day is still unplaced today', () => {
    expect(unplacedOn([task('placed', { scheduled: SAT0 })], placements, SAT0).map((t) => t.id)).toEqual(['placed'])
  })
})

describe('isStalePlacement (TB-17)', () => {
  const p = placement('p', 'a', SAT0, { blockId: 'job' })
  it('is stale when the task was re-Scheduled to a day it is not placed on', () => {
    expect(isStalePlacement(p, task('a', { scheduled: W0 }), [p])).toBe(true)
  })
  it('is not stale when Scheduled matches, is unset, or is another placed day', () => {
    expect(isStalePlacement(p, task('a', { scheduled: SAT0 }), [p])).toBe(false)
    expect(isStalePlacement(p, task('a'), [p])).toBe(false)
    const monday = placement('q', 'a', W0, { blockId: 'job' })
    expect(isStalePlacement(p, task('a', { scheduled: W0 }), [p, monday])).toBe(false)
  })
})

describe('time', () => {
  it('describeMinutes pads to HH:MM, including 24:00', () => {
    expect(describeMinutes(0)).toBe('00:00')
    expect(describeMinutes(360)).toBe('06:00')
    expect(describeMinutes(1050)).toBe('17:30')
    expect(describeMinutes(DAY)).toBe('24:00')
  })
  it('describeSpan joins with an en dash', () => {
    expect(describeSpan(360, 465)).toBe('06:00–07:45')
  })
  it('snap rounds to the step and clamps to the day', () => {
    expect(snap(367)).toBe(360)
    expect(snap(368)).toBe(375)
    expect(snap(-20)).toBe(0)
    expect(snap(1500)).toBe(DAY)
    expect(snap(1440)).toBe(DAY)
  })
})

describe('palette', () => {
  it('has twelve colours', () => {
    expect(BLOCK_COLOURS).toHaveLength(12)
    expect(new Set(BLOCK_COLOURS).size).toBe(12)
  })
  it('blockNames is one entry per name with the latest colour, sorted by name (TB-3)', () => {
    const blocks = [
      block('j1', { name: 'Job', colour: BLOCK_COLOURS[1], updatedAt: T(1) }),
      block('j2', { name: 'Job', colour: BLOCK_COLOURS[2], updatedAt: T(3) }),
      block('j3', { name: 'Job', colour: BLOCK_COLOURS[3], updatedAt: T(2) }),
      block('g', { name: 'Gym', colour: BLOCK_COLOURS[4] }),
    ]
    expect(blockNames(blocks)).toEqual([
      { name: 'Gym', colour: BLOCK_COLOURS[4] },
      { name: 'Job', colour: BLOCK_COLOURS[2] },
    ])
  })
  it('nextFreeBlockColour is the first colour no name uses', () => {
    expect(nextFreeBlockColour([])).toBe(BLOCK_COLOURS[0])
    const blocks = [block('a', { name: 'A', colour: BLOCK_COLOURS[0] }), block('b', { name: 'B', colour: BLOCK_COLOURS[1] })]
    expect(nextFreeBlockColour(blocks)).toBe(BLOCK_COLOURS[2])
  })
  it('falls back to the first colour once every one is taken', () => {
    const blocks = BLOCK_COLOURS.map((colour, i) => block(`b${i}`, { name: `Name ${i}`, colour }))
    expect(nextFreeBlockColour(blocks)).toBe(BLOCK_COLOURS[0])
  })
})
