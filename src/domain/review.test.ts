import { describe, expect, it } from 'vitest'
import { describeReview, weekReview } from './review'
import { buildTask, type Task } from './task'
import type { Routine } from './routine'
import type { Block, Placement } from './block'

// Week of Mon 14 Sep 2026; "today" is Thursday.
const WEEK = '2026-09-14'
const TODAY = '2026-09-17'
const T0 = '2026-09-01T00:00:00.000Z'

const doneOn = (id: string, date: string, spaceId = 'personal'): Task => ({
  ...buildTask({ title: id, spaceId }, id, [], T0),
  status: 'done',
  completedAt: `${date}T15:00:00.000Z`,
})

const routine = (id: string, days: number[] | 'daily', checkIns: string[]): Routine => ({
  id,
  title: id,
  schedule: days === 'daily' ? { kind: 'daily' } : { kind: 'weekdays', days: days as Routine['schedule'] extends { days: infer D } ? D : never },
  note: '',
  archived: false,
  checkIns,
  createdAt: T0,
  updatedAt: T0,
})

const block: Block = { id: 'job', name: 'Job', colour: '#000', weekday: 1, start: 540, end: 1020, from: WEEK, routineIds: [], createdAt: T0, updatedAt: T0 }
const placement = (id: string, taskId: string, date: string, rest: Partial<Placement> = {}): Placement => ({
  id,
  taskId,
  date,
  createdAt: T0,
  updatedAt: T0,
  ...rest,
})

describe('weekReview (PD-12)', () => {
  it('counts Tasks completed inside the week, grouped by Space, newest first', () => {
    const tasks = [
      doneOn('a', '2026-09-14'),
      doneOn('b', '2026-09-16'),
      doneOn('c', '2026-09-15', 'w1'),
      doneOn('before', '2026-09-13'),
      doneOn('after', '2026-09-21'),
      buildTask({ title: 'open' }, 'o', [], T0),
    ]
    const r = weekReview(tasks, [], [], [], WEEK, TODAY)
    expect(r.doneCount).toBe(3)
    expect(r.done.map((g) => [g.spaceId, g.tasks.map((t) => t.id)])).toEqual([
      ['personal', ['b', 'a']],
      ['w1', ['c']],
    ])
  })

  it('counts Check-ins over scheduled days so far, skipping Routines with no day yet', () => {
    const routines = [
      routine('daily', 'daily', ['2026-09-14', '2026-09-16']),
      routine('mwf', [1, 3, 5], ['2026-09-14']),
      routine('sat', [6], []),
      { ...routine('gone', 'daily', []), archived: true },
    ]
    const r = weekReview([], routines, [], [], WEEK, TODAY)
    expect(r.routines.map((x) => [x.routine.id, x.checked, x.scheduled])).toEqual([
      ['daily', 2, 4],
      ['mwf', 1, 2],
    ])
    expect([r.checked, r.scheduled]).toEqual([3, 6])
  })

  it('lists placements on past days whose Task is still open, with their block', () => {
    const open = buildTask({ title: 'open' }, 'o', [], T0)
    const tasks = [open, doneOn('d', '2026-09-15')]
    const placements = [
      placement('p1', 'o', '2026-09-14', { blockId: 'job' }),
      placement('p2', 'o', '2026-09-16', { start: 600, end: 660 }),
      placement('p3', 'o', '2026-09-17', { start: 600, end: 660 }), // today: not past
      placement('p4', 'd', '2026-09-15', { start: 600, end: 660 }), // done
      placement('p5', 'o', '2026-09-15', { blockId: 'nope' }), // block gone, untimed: nothing drawn
    ]
    const r = weekReview(tasks, [], [block], placements, WEEK, TODAY)
    expect(r.stale.map((s) => [s.placement.id, s.block?.name])).toEqual([
      ['p1', 'Job'],
      ['p2', undefined],
    ])
  })

  it('describes itself with quiet parts left out', () => {
    expect(describeReview(weekReview([], [], [], [], WEEK, TODAY))).toBe('0 done')
    const busy = weekReview([doneOn('a', '2026-09-14')], [routine('d', 'daily', [])], [], [], WEEK, TODAY)
    expect(describeReview(busy)).toBe('1 done · Routines 0/4')
  })
})
