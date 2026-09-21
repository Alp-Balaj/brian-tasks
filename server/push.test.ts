import { beforeEach, describe, expect, it } from 'vitest'
import { localClock, notificationsAt, tick, type Notification, type Subscription } from './push.ts'
import { buildTask, type Task } from '../src/domain/task.ts'
import type { Block, Placement } from '../src/domain/block.ts'

const T0 = '2026-09-01T00:00:00.000Z'
const DATE = '2026-09-21' // a Monday
const job: Block = { id: 'job', name: 'Job', colour: '#000', weekday: 1, start: 540, end: 1020, from: '2026-09-21', routineIds: [], createdAt: T0, updatedAt: T0 }
const placement = (id: string, taskId: string, rest: Partial<Placement>): Placement => ({ id, taskId, date: DATE, createdAt: T0, updatedAt: T0, ...rest })

describe('localClock', () => {
  it('reads the date and minute in the Device\'s zone', () => {
    const at = new Date('2026-09-21T23:30:00Z')
    expect(localClock(at, 'UTC')).toEqual({ date: '2026-09-21', minutes: 23 * 60 + 30 })
    expect(localClock(at, 'Europe/Amsterdam')).toEqual({ date: '2026-09-22', minutes: 90 })
    expect(localClock(at, 'America/Los_Angeles')).toEqual({ date: '2026-09-21', minutes: 16 * 60 + 30 })
  })
})

describe('notificationsAt (PD-18)', () => {
  const tasks: Task[] = [
    buildTask({ title: 'Write report', due: DATE }, 'a', [], T0),
    buildTask({ title: 'Done thing', status: 'done' }, 'b', [], T0),
    buildTask({ title: 'Later', scheduled: DATE }, 'c', [], T0),
    buildTask({ title: 'Old', due: '2026-09-18' }, 'd', [], T0),
  ]
  const placements = [
    placement('p1', 'a', { blockId: 'job', start: 600, end: 660 }),
    placement('p2', 'b', { start: 600, end: 630 }),
    placement('p3', 'c', { start: 660, end: 720 }),
    placement('p4', 'a', { blockId: 'job' }),
  ]

  it('tells about a timed Placement at its start when the Task is open', () => {
    expect(notificationsAt(tasks, [job], placements, DATE, 600)).toEqual<Notification[]>([
      { key: `placement:p1:${DATE}`, title: '10:00 · Write report', body: 'in Job until 11:00', url: '/home' },
    ])
    expect(notificationsAt(tasks, [job], placements, DATE, 660)).toEqual<Notification[]>([
      { key: `placement:p3:${DATE}`, title: '11:00 · Later', body: 'until 12:00', url: '/home' },
    ])
    expect(notificationsAt(tasks, [job], placements, DATE, 615)).toEqual([])
    expect(notificationsAt(tasks, [job], placements, '2026-09-22', 600)).toEqual([])
  })

  it('says one line about the day at 08:00, and nothing on an empty day', () => {
    expect(notificationsAt(tasks, [job], placements, DATE, 480)).toEqual<Notification[]>([
      { key: `morning:${DATE}`, title: 'Today', body: '1 due · 1 scheduled · 1 overdue', url: '/home' },
    ])
    expect(notificationsAt([], [], [], DATE, 480)).toEqual([])
  })
})

describe('tick (E9)', () => {
  const records = {
    tasks: async () => [buildTask({ title: 'Write report' }, 'a', [], T0)],
    blocks: async () => [job],
    placements: async () => [placement('p1', 'a', { start: 600, end: 660 })],
  }
  const amsterdam: Subscription = { endpoint: 'ams', subscription: { endpoint: 'ams', keys: { p256dh: '', auth: '' } }, tz: 'Europe/Amsterdam' }
  const london: Subscription = { endpoint: 'lon', subscription: { endpoint: 'lon', keys: { p256dh: '', auth: '' } }, tz: 'Europe/London' }
  let sent: string[]
  beforeEach(() => {
    sent = []
  })
  const send = async (sub: Subscription, n: Notification) => {
    sent.push(`${sub.endpoint} ${n.title}`)
  }

  it('sends each Device its own local minute, once', async () => {
    // 08:00 UTC = 10:00 Amsterdam = 09:00 London.
    await tick(records, [amsterdam, london], new Date(`${DATE}T08:00:00Z`), send)
    expect(sent).toEqual(['ams 10:00 · Write report'])
    await tick(records, [amsterdam, london], new Date(`${DATE}T08:00:30Z`), send)
    expect(sent).toEqual(['ams 10:00 · Write report'])
    await tick(records, [amsterdam, london], new Date(`${DATE}T09:00:00Z`), send)
    expect(sent).toEqual(['ams 10:00 · Write report', 'lon 10:00 · Write report'])
  })
})
