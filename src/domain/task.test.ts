import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  buildTask,
  checklistProgress,
  completeRepeating,
  describeEstimate,
  describeRepeat,
  finishesRepeating,
  nextDue,
  type Repeat,
  type Task,
} from './task'
import { DEFAULT_SPACE_ID } from './space'

const NOW = '2026-09-20T10:00:00.000Z'
const LATER = '2026-09-20T11:00:00.000Z'

describe('buildTask', () => {
  it('fills every default and files the task in Personal', () => {
    const task = buildTask({ title: '  Buy milk ' }, 'a', [], NOW)
    expect(task).toEqual<Task>({
      id: 'a',
      title: 'Buy milk',
      description: '',
      status: 'todo',
      priority: 'normal',
      tags: [],
      due: undefined,
      scheduled: undefined,
      order: -1,
      spaceId: DEFAULT_SPACE_ID,
      archived: false,
      pinned: false,
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: undefined,
    })
  })

  it('goes to the top of its own column only', () => {
    const existing = [
      buildTask({ title: 'x', status: 'todo', order: -5 }, 'x', [], NOW),
      buildTask({ title: 'y', status: 'hold', order: -9 }, 'y', [], NOW),
    ]
    expect(buildTask({ title: 'z' }, 'z', existing, NOW).order).toBe(-6)
    expect(buildTask({ title: 'z', status: 'hold' }, 'z', existing, NOW).order).toBe(-10)
    expect(buildTask({ title: 'z', status: 'done' }, 'z', existing, NOW).order).toBe(-1)
  })

  it('a task born done is completed and never pinned', () => {
    const task = buildTask({ title: 'x', status: 'done', pinned: true }, 'a', [], NOW)
    expect(task.completedAt).toBe(NOW)
    expect(task.pinned).toBe(false)
  })
})

describe('applyPatch', () => {
  const base = buildTask({ title: 'x', pinned: true }, 'a', [], NOW)

  it('bumps updatedAt and keeps the rest', () => {
    const next = applyPatch(base, { title: 'y' }, LATER)
    expect(next).toEqual({ ...base, title: 'y', updatedAt: LATER })
  })

  it('records completedAt on the way into done and unpins', () => {
    const done = applyPatch(base, { status: 'done' }, LATER)
    expect(done.completedAt).toBe(LATER)
    expect(done.pinned).toBe(false)
    const back = applyPatch(done, { status: 'todo' }, LATER)
    expect(back.completedAt).toBeUndefined()
  })

  it('an explicit undefined clears a date', () => {
    const dated = applyPatch(base, { due: '2026-09-21' }, LATER)
    expect(applyPatch(dated, { due: undefined }, LATER).due).toBeUndefined()
  })
})

describe('nextDue (PD-5)', () => {
  const rule = (every: number, unit: Repeat['unit'], from: Repeat['from'] = 'due'): Repeat => ({ every, unit, from })

  it('steps days and weeks', () => {
    expect(nextDue(rule(3, 'day'), '2026-09-28', '2026-09-28')).toBe('2026-10-01')
    expect(nextDue(rule(2, 'week'), '2026-09-21', '2026-09-20')).toBe('2026-10-05')
  })

  it('clamps the day of month and steps years', () => {
    expect(nextDue(rule(1, 'month'), '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextDue(rule(1, 'month'), '2028-01-31', '2028-01-31')).toBe('2028-02-29')
    expect(nextDue(rule(1, 'year'), '2028-02-29', '2028-02-29')).toBe('2029-02-28')
  })

  it('due-anchored advances past the completion day, once', () => {
    // Rent due 1 Jul, paid on 20 Sep: comes back 1 Oct, not 1 Aug.
    expect(nextDue(rule(1, 'month'), '2026-07-01', '2026-09-20')).toBe('2026-10-01')
    // Finished early: the next occurrence stays where the rule puts it.
    expect(nextDue(rule(1, 'month'), '2026-10-01', '2026-09-20')).toBe('2026-11-01')
  })

  it('done-anchored counts from the completion day', () => {
    expect(nextDue(rule(3, 'day', 'done'), '2026-07-01', '2026-09-20')).toBe('2026-09-23')
  })
})

describe('completeRepeating (PD-5)', () => {
  const rent = buildTask(
    {
      title: 'Rent',
      description: 'Transfer',
      priority: 'high',
      tags: ['money'],
      spaceId: 'w1',
      pinned: true,
      due: '2026-10-01',
      scheduled: '2026-09-30',
      estimate: 15,
      checklist: [{ id: 'c1', text: 'Check balance', done: true }],
      repeat: { every: 1, unit: 'month', from: 'due' },
    },
    'r',
    [],
    NOW,
  ) as Task & { repeat: Repeat }

  it('finishes the Task without its Repeat and spawns the next occurrence', () => {
    const others = [buildTask({ title: 'x', order: -3 }, 'x', [], NOW)]
    const { done, next } = completeRepeating(rent, others, 'r2', LATER, '2026-09-20')
    expect(done).toMatchObject({ id: 'r', status: 'done', completedAt: LATER, pinned: false, updatedAt: LATER })
    expect('repeat' in done).toBe(false)
    expect(next).toMatchObject({
      id: 'r2',
      title: 'Rent',
      description: 'Transfer',
      priority: 'high',
      tags: ['money'],
      spaceId: 'w1',
      pinned: true,
      status: 'todo',
      due: '2026-11-01',
      scheduled: undefined,
      order: -4,
      estimate: 15,
      checklist: [{ id: 'c1', text: 'Check balance', done: false }],
      repeat: { every: 1, unit: 'month', from: 'due' },
      createdAt: LATER,
    })
  })

  it('a repeating Task with no Due counts from today', () => {
    const { due: _d, ...noDue } = rent
    const { next } = completeRepeating(noDue as Task & { repeat: Repeat }, [], 'n', LATER, '2026-09-20')
    expect(next.due).toBe('2026-10-20')
  })

  it('finishesRepeating only on the way into done', () => {
    expect(finishesRepeating(rent, { status: 'done' })).toBe(true)
    expect(finishesRepeating(rent, { status: 'hold' })).toBe(false)
    expect(finishesRepeating({ ...rent, status: 'done' }, { status: 'done' })).toBe(false)
    const { repeat: _r, ...plain } = rent
    expect(finishesRepeating(plain, { status: 'done' })).toBe(false)
  })
})

describe('describe helpers', () => {
  it('estimates and repeats read as the chips do', () => {
    expect(describeEstimate(45)).toBe('45m')
    expect(describeEstimate(60)).toBe('1h')
    expect(describeEstimate(90)).toBe('1h30')
    expect(describeRepeat({ every: 1, unit: 'day', from: 'due' })).toBe('Every day')
    expect(describeRepeat({ every: 2, unit: 'week', from: 'done' })).toBe('Every 2 weeks after done')
    expect(checklistProgress([{ id: 'a', text: 'a', done: true }, { id: 'b', text: 'b', done: false }])).toEqual({ done: 1, total: 2 })
    expect(checklistProgress(undefined)).toEqual({ done: 0, total: 0 })
  })
})
