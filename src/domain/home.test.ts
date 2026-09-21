import { describe, expect, it } from 'vitest'
import { buildTask, type NewTask } from './task'
import { homeSections, openRows } from './home'

const NOW = '2026-09-20T10:00:00.000Z'
const TODAY = '2026-09-20'

const make = (id: string, input: Omit<NewTask, 'title'> & { title?: string }) =>
  buildTask({ title: id, ...input }, id, [], NOW)

const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('homeSections', () => {
  it('files each task in the first section it qualifies for', () => {
    const tasks = [
      make('overdue-and-pinned', { due: '2026-09-01', pinned: true }),
      make('due-today-in-progress', { due: TODAY, status: 'in-progress' }),
      make('scheduled-today', { scheduled: TODAY }),
      make('pinned-in-progress', { pinned: true, status: 'in-progress' }),
      make('just-in-progress', { status: 'in-progress' }),
      make('plain', {}),
    ]
    const s = homeSections(tasks, TODAY)
    expect(ids(s.overdue)).toEqual(['overdue-and-pinned'])
    expect(ids(s.today.map((r) => r.task))).toEqual(['due-today-in-progress', 'scheduled-today'])
    expect(ids(s.pinned)).toEqual(['pinned-in-progress'])
    expect(ids(s.inProgress)).toEqual(['just-in-progress'])
  })

  it('leaves out done and archived tasks everywhere', () => {
    const tasks = [
      make('done-overdue', { due: '2026-09-01', status: 'done' }),
      make('done-today', { due: TODAY, status: 'done' }),
      make('archived', { due: '2026-09-01', archived: true }),
    ]
    const s = homeSections(tasks, TODAY)
    expect(s.overdue).toEqual([])
    expect(s.today).toEqual([])
    expect(s.pinned).toEqual([])
    expect(s.inProgress).toEqual([])
  })

  it('orders overdue by oldest deadline, then priority', () => {
    const tasks = [
      make('recent-urgent', { due: '2026-09-18', priority: 'urgent' }),
      make('old-low', { due: '2026-09-01', priority: 'low' }),
      make('old-high', { due: '2026-09-01', priority: 'high' }),
    ]
    expect(ids(homeSections(tasks, TODAY).overdue)).toEqual(['old-high', 'old-low', 'recent-urgent'])
  })

  it('puts due-today before scheduled-today', () => {
    const tasks = [make('sched', { scheduled: TODAY }), make('due', { due: TODAY })]
    expect(homeSections(tasks, TODAY).today.map((r) => r.reason)).toEqual(['due today', 'scheduled'])
  })
})

describe('openRows (PD-9)', () => {
  const t = (id: string, input: Omit<NewTask, 'title'>) => make(id, input)
  it('lists what is still open on today once each, by the date that put it there', () => {
    const tasks = [
      t('overdue', { due: '2026-09-18', priority: 'low' }),
      t('dueToday', { due: '2026-09-20', scheduled: '2026-09-20' }),
      t('scheduled', { scheduled: '2026-09-20' }),
      t('placedOnly', {}),
      t('placedAndScheduled', { scheduled: '2026-09-20' }),
      t('done', { status: 'done', due: '2026-09-20' }),
      t('archived', { archived: true, due: '2026-09-19' }),
      t('tomorrow', { due: '2026-09-21' }),
    ]
    const rows = openRows(tasks, new Set(['placedOnly', 'placedAndScheduled']), '2026-09-20')
    expect(rows.map((r) => [r.task.id, r.reason])).toEqual([
      ['dueToday', 'due'],
      ['overdue', 'due'],
      ['placedAndScheduled', 'scheduled'],
      ['scheduled', 'scheduled'],
      ['placedOnly', 'placed'],
    ])
  })
})
