import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasks } from './tasks'
import { useTombstones } from './tombstones'

const T0 = new Date(2026, 8, 20, 10, 0, 0) // Sunday 20 Sep 2026, local time

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  useTasks.setState({ tasks: [] })
  useTombstones.setState({ tombstones: [] })
})

describe('update with a Repeat (PD-5)', () => {
  it('finishes the Task and spawns the next occurrence at the top of To do', () => {
    const { add, update } = useTasks.getState()
    add({ title: 'Other' })
    const rent = add({ title: 'Rent', due: '2026-10-01', repeat: { every: 1, unit: 'month', from: 'due' }, pinned: true })
    update(rent.id, { status: 'done', title: 'Rent (Sept)' })
    const tasks = useTasks.getState().tasks
    expect(tasks).toHaveLength(3)
    const done = tasks.find((t) => t.id === rent.id)!
    expect(done).toMatchObject({ title: 'Rent (Sept)', status: 'done', pinned: false })
    expect(done.repeat).toBeUndefined()
    const next = tasks[0]
    expect(next).toMatchObject({ title: 'Rent (Sept)', status: 'todo', due: '2026-11-01', pinned: true })
    expect(next.repeat).toEqual({ every: 1, unit: 'month', from: 'due' })
    expect(next.order).toBeLessThan(Math.min(...tasks.filter((t) => t.status === 'todo' && t.id !== next.id).map((t) => t.order)))
  })

  it('move into Done spawns too; move elsewhere does not', () => {
    const { add, move } = useTasks.getState()
    const water = add({ title: 'Water plants', due: '2026-09-20', repeat: { every: 3, unit: 'day', from: 'done' } })
    move(water.id, 'hold', 0)
    expect(useTasks.getState().tasks).toHaveLength(1)
    move(water.id, 'done', 0)
    const tasks = useTasks.getState().tasks
    expect(tasks).toHaveLength(2)
    expect(tasks.find((t) => t.id === water.id)!.status).toBe('done')
    expect(tasks.find((t) => t.id !== water.id)).toMatchObject({ status: 'todo', due: '2026-09-23' })
  })

  it('an ordinary Task is unaffected', () => {
    const { add, update } = useTasks.getState()
    const plain = add({ title: 'Plain' })
    update(plain.id, { status: 'done' })
    expect(useTasks.getState().tasks).toHaveLength(1)
  })
})

describe('later (PD-10)', () => {
  it('moves the named field to tomorrow, next week, a day, or clears Scheduled', () => {
    const { add, later } = useTasks.getState()
    const t = add({ title: 'x', due: '2026-09-20', scheduled: '2026-09-20' })
    const get = () => useTasks.getState().tasks[0]
    later(t.id, 'tomorrow', 'due')
    expect(get().due).toBe('2026-09-21')
    later(t.id, 'next-week', 'scheduled')
    expect(get()).toMatchObject({ due: '2026-09-21', scheduled: '2026-09-27' })
    later(t.id, '2026-10-05', 'due')
    expect(get().due).toBe('2026-10-05')
    later(t.id, 'unschedule', 'due')
    expect(get()).toMatchObject({ due: '2026-10-05', scheduled: undefined })
  })
})
