import { describe, expect, it } from 'vitest'
import { applyPatch, buildTask, type Task } from './task'
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
