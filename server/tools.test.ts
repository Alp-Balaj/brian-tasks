// The tools as a client sees them: a real McpServer and Client joined by an
// in-memory transport, over an in-memory Records that applies the sync rule.
import { beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { registerTools } from './tools.ts'
import type { Records } from './records.ts'
import type { Row } from './db.ts'
import { buildTask, type Task } from '../src/domain/task.ts'
import { defaultSpace, type Space } from '../src/domain/space.ts'
import type { CheckIn, RoutineRecord } from '../src/domain/routine.ts'

const NOW = new Date(2026, 8, 20, 10, 0, 0) // Sunday 20 Sep 2026, local time
const TODAY = '2026-09-20'
/** Starts at NOW and moves a second per reading, so consecutive writes never tie. */
const ticking = () => {
  let t = NOW.getTime() - 1000
  return () => new Date((t += 1000))
}
const sameDay = (iso: string) => expect(iso.startsWith(NOW.toISOString().slice(0, 13))).toBe(true)

function memoryRecords(seed: Row[] = []): Records & { rows: Map<string, Row> } {
  const rows = new Map(seed.map((r) => [`${r.kind}:${r.id}`, r]))
  const live = <T>(kind: string) => async () =>
    [...rows.values()].filter((r) => r.kind === kind && !r.deleted).map((r) => r.data as T)
  return {
    rows,
    tasks: live<Task>('task'),
    spaces: live<Space>('space'),
    routines: live<RoutineRecord>('routine'),
    checkIns: live<CheckIn>('checkin'),
    async put(incoming) {
      for (const row of incoming) {
        const key = `${row.kind}:${row.id}`
        const current = rows.get(key)
        if (!current || current.updatedAt < row.updatedAt) rows.set(key, row)
      }
    },
  }
}

const liveRow = <T extends { updatedAt: string }>(kind: string, id: string, data: T): Row => ({
  kind,
  id,
  updatedAt: data.updatedAt,
  deleted: false,
  data,
})

const work: Space = { id: 'w1', name: 'Work', colour: '#5b6fb8', order: 1, updatedAt: '2026-09-01T00:00:00.000Z' }
const reading: RoutineRecord = {
  id: 'r1',
  title: 'Read 20 pages',
  schedule: { kind: 'daily' },
  note: '',
  archived: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}
const gym: RoutineRecord = { ...reading, id: 'r2', title: 'Gym', schedule: { kind: 'weekdays', days: [1, 3, 5] } }

let records: ReturnType<typeof memoryRecords>
let client: Client

beforeEach(async () => {
  const t0 = '2026-09-10T00:00:00.000Z'
  const seed = [
    liveRow('space', 'personal', defaultSpace()),
    liveRow('space', work.id, work),
    liveRow('routine', reading.id, reading),
    liveRow('routine', gym.id, gym),
    liveRow('checkin', 'r1:2026-09-19', { routineId: 'r1', date: '2026-09-19', updatedAt: t0 }),
  ]
  const tasks = [
    buildTask({ title: 'Overdue report', due: '2026-09-18', spaceId: 'w1', priority: 'high' }, 'a', [], t0),
    buildTask({ title: 'Plan week', scheduled: TODAY, pinned: true }, 'b', [], t0),
    buildTask({ title: 'Old thing', status: 'done' }, 'c', [], t0),
    buildTask({ title: 'Hidden', archived: true, tags: ['x'] }, 'd', [], t0),
  ]
  for (const t of tasks) seed.push(liveRow('task', t.id, t))
  records = memoryRecords(seed)

  const server = new McpServer({ name: 'test', version: '0' })
  registerTools(server, records, ticking())
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  client = new Client({ name: 'test-client', version: '0' })
  await client.connect(clientSide)
})

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as CallToolResult
  const text = (res.content[0] as { text: string }).text
  return { isError: res.isError === true, text, data: res.isError ? undefined : JSON.parse(text) }
}

describe('today', () => {
  it('mirrors Home: overdue, routines scheduled today, today rows with reasons, pinned, in progress', async () => {
    const { data } = await call('today')
    expect(data.date).toBe(TODAY)
    // Sunday: the daily routine is on, the Mon/Wed/Fri one is not.
    expect(data.routines.map((r: { title: string }) => r.title)).toEqual(['Read 20 pages'])
    expect(data.routines[0]).toMatchObject({ done: false, streak: 1, schedule: 'Every day' })
    expect(data.overdue.map((t: { id: string }) => t.id)).toEqual(['a'])
    expect(data.overdue[0].space).toBe('Work')
    // 'b' is scheduled today and pinned; Today wins, so it is not repeated under Pinned.
    expect(data.today.map((t: { id: string; reason: string }) => [t.id, t.reason])).toEqual([['b', 'scheduled']])
    expect(data.pinned).toEqual([])
    expect(data.inProgress).toEqual([])
  })
})

describe('list_tasks', () => {
  it('defaults to open, non-archived tasks', async () => {
    const { data } = await call('list_tasks')
    expect(data.tasks.map((t: { id: string }) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('filters by status, space, tag, search, due and archived', async () => {
    expect((await call('list_tasks', { status: 'done' })).data.tasks.map((t: { id: string }) => t.id)).toEqual(['c'])
    expect((await call('list_tasks', { space: 'work' })).data.tasks.map((t: { id: string }) => t.id)).toEqual(['a'])
    expect((await call('list_tasks', { status: 'all', include_archived: true, tag: 'x' })).data.count).toBe(1)
    expect((await call('list_tasks', { search: 'PLAN' })).data.tasks[0].id).toBe('b')
    expect((await call('list_tasks', { due_by: '2026-09-18' })).data.count).toBe(1)
    expect((await call('list_tasks', { due_by: '2026-09-17' })).data.count).toBe(0)
  })

  it('names the Spaces when one is unknown', async () => {
    const res = await call('list_tasks', { space: 'Uni' })
    expect(res.isError).toBe(true)
    expect(res.text).toContain('Personal, Work')
  })
})

describe('create_task', () => {
  it('builds a task exactly as the app would and stores it as a row', async () => {
    const { data } = await call('create_task', { title: '  Call the bank ', space: 'Work', due: '2026-09-22', tags: ['phone'] })
    expect(data).toMatchObject({ title: 'Call the bank', status: 'todo', priority: 'normal', space: 'Work', due: '2026-09-22', tags: ['phone'] })
    const row = records.rows.get(`task:${data.id}`)!
    expect(row.deleted).toBe(false)
    const stored = row.data as Task
    expect(stored.spaceId).toBe('w1')
    sameDay(stored.createdAt)
    expect(stored.order).toBe(-2) // above the existing todo tasks (order -1)
  })

  it('rejects an unknown Space instead of guessing', async () => {
    const res = await call('create_task', { title: 'x', space: 'Nope' })
    expect(res.isError).toBe(true)
    expect(records.rows.size).toBe(9)
  })

  it('rejects a bad date', async () => {
    const res = await call('create_task', { title: 'x', due: 'tomorrow' })
    expect(res.isError).toBe(true)
  })
})

describe('update_task', () => {
  it('completes, unpins, moves Space, clears a date', async () => {
    const { data } = await call('update_task', { id: 'b', status: 'done', space: 'w1', scheduled: null })
    expect(data).toMatchObject({ status: 'done', space: 'Work' })
    expect(data.pinned).toBeUndefined()
    expect(data.scheduled).toBeUndefined()
    const stored = records.rows.get('task:b')!.data as Task
    expect(stored.pinned).toBe(false)
    expect(stored.completedAt).toBe(stored.updatedAt)
    sameDay(stored.updatedAt)
  })

  it('archives instead of deleting', async () => {
    const { data } = await call('update_task', { id: 'a', archived: true })
    expect(data.archived).toBe(true)
    expect((await call('list_tasks')).data.count).toBe(1)
  })

  it('fails on an unknown id', async () => {
    expect((await call('update_task', { id: 'zzz', title: 'x' })).isError).toBe(true)
  })
})

describe('routines', () => {
  it('check_in by title is idempotent and extends the streak', async () => {
    const first = await call('check_in', { routine: 'read 20 pages' })
    expect(first.data).toMatchObject({ done: true, streak: 2 })
    expect(records.rows.get(`checkin:r1:${TODAY}`)).toMatchObject({ deleted: false })
    const again = await call('check_in', { routine: 'r1' })
    expect(again.data.alreadyDone).toBe(true)
  })

  it('uncheck writes a tombstone for that day only', async () => {
    await call('check_in', { routine: 'Gym' })
    const { data } = await call('uncheck', { routine: 'Gym' })
    expect(data.done).toBe(false)
    expect(records.rows.get(`checkin:r2:${TODAY}`)).toMatchObject({ deleted: true, data: null })
    expect(records.rows.get('checkin:r1:2026-09-19')!.deleted).toBe(false)
  })

  it('list_routines shows schedule and today state', async () => {
    const { data } = await call('list_routines')
    expect(data).toEqual([
      expect.objectContaining({ title: 'Read 20 pages', scheduledToday: true, done: false, streak: 1 }),
      expect.objectContaining({ title: 'Gym', schedule: 'Mon, Wed, Fri', scheduledToday: false }),
    ])
  })
})

describe('spaces', () => {
  it('list_spaces is in switcher order and always includes Personal', async () => {
    records.rows.delete('space:personal')
    const { data } = await call('list_spaces')
    expect(data.map((s: { name: string }) => s.name)).toEqual(['Personal', 'Work'])
    expect(data[1].colour).toBe('blue')
  })

  it('create_space stores a row the app will pick up, at the bottom, in the next free colour', async () => {
    const { data } = await call('create_space', { name: '  University ' })
    expect(data).toEqual({ id: expect.any(String), name: 'University', colour: 'orange' })
    const stored = records.rows.get(`space:${data.id}`)!.data as Space
    expect(stored).toMatchObject({ colour: '#a8622a', order: 2 })
    sameDay(stored.updatedAt)
    expect((await call('list_spaces')).data.map((s: { name: string }) => s.name)).toEqual(['Personal', 'Work', 'University'])
    // ...and Tasks can be filed into it straight away, by name.
    expect((await call('create_task', { title: 'Essay', space: 'university' })).data.space).toBe('University')
  })

  it('create_space takes a palette colour by name and rejects others', async () => {
    const { data } = await call('create_space', { name: 'Side', colour: 'red' })
    expect(data.colour).toBe('red')
    expect((records.rows.get(`space:${data.id}`)!.data as Space).colour).toBe('#b8434e')
    expect((await call('create_space', { name: 'Other', colour: '#123456' })).isError).toBe(true)
  })

  it('create_space is idempotent on the name', async () => {
    const { data } = await call('create_space', { name: 'work' })
    expect(data).toMatchObject({ id: 'w1', name: 'Work', alreadyExists: true })
    expect(records.rows.size).toBe(9)
  })

  it('update_space renames and recolours, by name or id', async () => {
    const { data } = await call('update_space', { space: 'work', name: 'Job', colour: 'teal' })
    expect(data).toEqual({ id: 'w1', name: 'Job', colour: 'teal' })
    const stored = records.rows.get('space:w1')!.data as Space
    expect(stored).toMatchObject({ name: 'Job', colour: '#2a8fa8', order: 1 })
    sameDay(stored.updatedAt)
    expect((await call('update_space', { space: 'w1', colour: 'grey' })).data).toMatchObject({ name: 'Job', colour: 'grey' })
  })

  it('update_space refuses a name another Space has, and an unknown Space', async () => {
    const clash = await call('update_space', { space: 'Work', name: 'personal' })
    expect(clash.isError).toBe(true)
    expect(clash.text).toContain('Personal')
    expect((await call('update_space', { space: 'Uni', name: 'x' })).isError).toBe(true)
  })
})
