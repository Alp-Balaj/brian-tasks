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
import type { Block, Placement } from '../src/domain/block.ts'

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
    blocks: live<Block>('block'),
    placements: live<Placement>('placement'),
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
  client = await connect(ticking())
})

/** A client over a fresh server on `records`, reading time from `clock`. */
async function connect(clock: () => Date): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0' })
  registerTools(server, records, clock)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const c = new Client({ name: 'test-client', version: '0' })
  await c.connect(clientSide)
  return c
}

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

  it('reports no blocks, no placements and open time when the week is empty', async () => {
    const { data } = await call('today')
    expect(data).toMatchObject({ blocks: [], placements: [], now: null })
    expect(data.routines[0].at).toBeUndefined()
  })

  describe('with blocks', () => {
    const t0 = '2026-09-14T00:00:00.000Z'
    /** Sunday blocks in the week of NOW. */
    const block = (id: string, name: string, start: number, end: number, routineIds: string[] = []): Block => ({
      id,
      name,
      colour: '#64748b',
      weekday: 0,
      start,
      end,
      from: '2026-09-14',
      routineIds,
      createdAt: t0,
      updatedAt: t0,
    })
    const placement = (id: string, taskId: string, rest: Partial<Placement> = {}): Placement => ({
      id,
      taskId,
      date: TODAY,
      createdAt: t0,
      updatedAt: t0,
      ...rest,
    })
    const at = (h: number, m = 0) => () => new Date(2026, 8, 20, h, m, 0)

    beforeEach(async () => {
      await records.put([
        liveRow('block', 'k1', block('k1', 'Morning', 6 * 60, 8 * 60, ['r1'])),
        liveRow('block', 'k2', block('k2', 'Job', 9 * 60, 17 * 60)),
        // Last week's version of Job: not in force this week (ADR 0003).
        liveRow('block', 'k0', { ...block('k0', 'Job', 8 * 60, 16 * 60), from: '2026-09-07', until: '2026-09-14' }),
        // A Saturday block never shows on Sunday.
        liveRow('block', 'k3', { ...block('k3', 'Gym', 10 * 60, 11 * 60), weekday: 6 }),
        liveRow('placement', 'p1', placement('p1', 'b', { blockId: 'k1' })),
        liveRow('placement', 'p2', placement('p2', 'a', { blockId: 'k1', start: 7 * 60, end: 7 * 60 + 30 })),
        liveRow('placement', 'p3', placement('p3', 'c', { start: 14 * 60, end: 15 * 60 })),
        // Untimed and not in a block on this day: not drawn anywhere.
        liveRow('placement', 'p4', placement('p4', 'a', { blockId: 'k3' })),
        liveRow('placement', 'p5', placement('p5', 'b', { date: '2026-09-21', start: 9 * 60, end: 10 * 60 })),
      ])
    })

    it('lists the blocks in force on the day with their routines and placed tasks', async () => {
      const { data } = await call('today')
      expect(data.blocks).toEqual([
        {
          name: 'Morning',
          start: '06:00',
          end: '08:00',
          routines: ['Read 20 pages'],
          // Timed ones first, then "sometime during this block" (TB-8, TB-11).
          tasks: [
            expect.objectContaining({ id: 'a', title: 'Overdue report', start: '07:00', end: '07:30' }),
            expect.objectContaining({ id: 'b', title: 'Plan week' }),
          ],
        },
        { name: 'Job', start: '09:00', end: '17:00', routines: [], tasks: [] },
      ])
      expect(data.blocks[0].tasks[1].start).toBeUndefined()
      // Timed and outside any block; a done task stays listed (TB-16).
      expect(data.placements).toEqual([expect.objectContaining({ id: 'c', status: 'done', start: '14:00', end: '15:00' })])
      // The routine the Morning block links gets the block's hour (TB-20).
      expect(data.routines[0]).toMatchObject({ title: 'Read 20 pages', at: '06:00' })
    })

    it('names the block under way, and none at the exact minute it ends', async () => {
      client = await connect(at(7, 59))
      expect((await call('today')).data.now).toEqual({ name: 'Morning', until: '08:00' })
      client = await connect(at(8))
      expect((await call('today')).data.now).toBeNull()
      client = await connect(at(9))
      expect((await call('today')).data.now).toEqual({ name: 'Job', until: '17:00' })
      client = await connect(at(17))
      expect((await call('today')).data.now).toBeNull()
    })

    it('leaves now out for any day but the clock’s today', async () => {
      const { data } = await call('today', { date: '2026-09-21' })
      expect('now' in data).toBe(false)
      expect(data.blocks).toEqual([])
      expect(data.placements).toEqual([expect.objectContaining({ id: 'b', start: '09:00', end: '10:00' })])
    })
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

describe('task fields (PD-1, PD-3, PD-4)', () => {
  it('create_task takes an estimate (rounded to 15), a checklist and a repeat, giving a repeat a due date', async () => {
    const { data } = await call('create_task', {
      title: 'Rent',
      estimate: 50,
      checklist: ['Check balance', { text: 'Transfer', done: true }],
      repeat: { unit: 'month' },
    })
    expect(data).toMatchObject({ estimate: 45, due: TODAY, repeat: { every: 1, unit: 'month', from: 'due' } })
    expect(data.checklist.map((i: { text: string; done: boolean }) => [i.text, i.done])).toEqual([
      ['Check balance', false],
      ['Transfer', true],
    ])
    const short = (await call('list_tasks', { search: 'rent' })).data.tasks[0]
    expect(short).toMatchObject({ estimate: 45, checklist: { done: 1, total: 2 }, repeat: 'Every month' })
  })

  it('update_task replaces the checklist keeping ids of unchanged items, and clears with null', async () => {
    const made = (await call('create_task', { title: 'Steps', checklist: ['a', 'b'], estimate: 30 })).data
    const [a] = made.checklist
    const { data } = await call('update_task', { id: made.id, checklist: [{ text: 'a', done: true }, 'c'], estimate: null })
    expect(data.checklist[0]).toEqual({ id: a.id, text: 'a', done: true })
    expect(data.checklist[1].id).not.toBe(made.checklist[1].id)
    expect(data.estimate).toBeUndefined()
    const cleared = (await call('update_task', { id: made.id, checklist: [] })).data
    expect(cleared.checklist).toBeUndefined()
  })

  it('finishing a repeating Task keeps it done and returns the next occurrence (PD-5)', async () => {
    const rent = (await call('create_task', { title: 'Rent', due: '2026-10-01', repeat: { unit: 'month' }, pinned: true, space: 'Work' })).data
    const { data } = await call('update_task', { id: rent.id, status: 'done' })
    expect(data).toMatchObject({ id: rent.id, status: 'done' })
    expect(data.repeat).toBeUndefined()
    expect(data.next).toMatchObject({ title: 'Rent', status: 'todo', due: '2026-11-01', pinned: true, space: 'Work', repeat: { unit: 'month' } })
    const stored = records.rows.get(`task:${data.next.id}`)!.data as Task
    expect(stored.due).toBe('2026-11-01')
    expect((records.rows.get(`task:${rent.id}`)!.data as Task).status).toBe('done')
  })

  it('list_tasks completed_since implies done and filters by completion day', async () => {
    await call('update_task', { id: 'a', status: 'done' })
    const { data } = await call('list_tasks', { completed_since: TODAY })
    expect(data.tasks.map((t: { id: string }) => t.id)).toEqual(['a'])
    expect((await call('list_tasks', { completed_since: '2026-09-21' })).data.count).toBe(0)
    // 'c' was finished on 10 Sep in the seed.
    expect((await call('list_tasks', { completed_until: '2026-09-10' })).data.tasks.map((t: { id: string }) => t.id)).toEqual(['c'])
    expect((await call('list_tasks', { completed_until: TODAY })).data.count).toBe(2)
  })
})

describe('delete_task', () => {
  it('buries the Task and its Placements, and leaves everything else', async () => {
    const t0 = '2026-09-14T00:00:00.000Z'
    await records.put([
      liveRow('placement', 'pa', { id: 'pa', taskId: 'a', date: TODAY, createdAt: t0, updatedAt: t0 }),
      liveRow('placement', 'pb', { id: 'pb', taskId: 'b', date: TODAY, createdAt: t0, updatedAt: t0 }),
    ])
    const { data } = await call('delete_task', { id: 'a' })
    expect(data).toEqual({ id: 'a', title: 'Overdue report', deleted: true, placementsRemoved: 1 })
    expect(records.rows.get('task:a')).toMatchObject({ deleted: true, data: null })
    expect(records.rows.get('placement:pa')).toMatchObject({ deleted: true, data: null })
    expect(records.rows.get('placement:pb')!.deleted).toBe(false)
    expect((await call('get_task', { id: 'a' })).isError).toBe(true)
    expect((await call('today')).data.overdue).toEqual([])
  })

  it('deletes an archived Task too, and fails on an unknown id', async () => {
    expect((await call('delete_task', { id: 'd' })).data).toEqual({ id: 'd', title: 'Hidden', deleted: true })
    expect((await call('list_tasks', { status: 'all', include_archived: true })).data.count).toBe(3)
    expect((await call('delete_task', { id: 'd' })).isError).toBe(true)
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

  it('delete_routine buries the Routine and every Check-in it had, by title or id', async () => {
    await call('check_in', { routine: 'Read 20 pages' })
    const { data } = await call('delete_routine', { routine: 'read 20 PAGES' })
    expect(data).toEqual({ id: 'r1', title: 'Read 20 pages', deleted: true, checkInsRemoved: 2 })
    expect(records.rows.get('routine:r1')).toMatchObject({ deleted: true, data: null })
    expect(records.rows.get('checkin:r1:2026-09-19')).toMatchObject({ deleted: true, data: null })
    expect(records.rows.get(`checkin:r1:${TODAY}`)).toMatchObject({ deleted: true, data: null })
    expect((await call('list_routines')).data.map((r: { id: string }) => r.id)).toEqual(['r2'])
    expect((await call('delete_routine', { routine: 'r2' })).data).toEqual({ id: 'r2', title: 'Gym', deleted: true })
    expect((await call('delete_routine', { routine: 'Gym' })).isError).toBe(true)
  })

  it('list_routines with days adds a history per day (PD-14)', async () => {
    const { data } = await call('list_routines', { days: 3 })
    // Sunday: the daily one was done yesterday; the Mon/Wed/Fri one is off at the weekend and was missed Friday.
    expect(data[0].history).toEqual({ '2026-09-18': 'missed', '2026-09-19': 'done', [TODAY]: 'open' })
    expect(data[1].history).toEqual({ '2026-09-18': 'missed', '2026-09-19': 'off', [TODAY]: 'off' })
    expect((await call('list_routines')).data[0].history).toBeUndefined()
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

  it('delete_space buries the Space and moves its Tasks to Personal, archived ones included', async () => {
    await call('update_task', { id: 'd', space: 'Work' })
    const { data } = await call('delete_space', { space: 'work' })
    expect(data).toEqual({ id: 'w1', name: 'Work', deleted: true, tasksMoved: 2 })
    expect(records.rows.get('space:w1')).toMatchObject({ deleted: true, data: null })
    const a = records.rows.get('task:a')!.data as Task
    expect(a.spaceId).toBe('personal')
    sameDay(a.updatedAt)
    expect((records.rows.get('task:d')!.data as Task).spaceId).toBe('personal')
    expect((records.rows.get('task:b')!.data as Task).updatedAt).toBe('2026-09-10T00:00:00.000Z')
    expect((await call('list_spaces')).data.map((s: { name: string }) => s.name)).toEqual(['Personal'])
    expect((await call('get_task', { id: 'a' })).data.space).toBe('Personal')
  })

  it('delete_space refuses Personal and an unknown Space', async () => {
    const personal = await call('delete_space', { space: 'Personal' })
    expect(personal.isError).toBe(true)
    expect(personal.text).toContain('default Space')
    expect(records.rows.get('space:personal')!.deleted).toBe(false)
    expect((await call('delete_space', { space: 'Nope' })).isError).toBe(true)
  })

  it('update_space refuses a name another Space has, and an unknown Space', async () => {
    const clash = await call('update_space', { space: 'Work', name: 'personal' })
    expect(clash.isError).toBe(true)
    expect(clash.text).toContain('Personal')
    expect((await call('update_space', { space: 'Uni', name: 'x' })).isError).toBe(true)
  })
})

describe('blocks', () => {
  // Weeks: W_1 = Mon 2026-09-07, W0 = Mon 2026-09-14 (NOW's week), W1 = Mon 2026-09-21.
  const W_1 = '2026-09-07'
  const W0 = '2026-09-14'
  const W1 = '2026-09-21'
  const t0 = '2026-09-01T00:00:00.000Z'
  const block = (id: string, rest: Partial<Block>): Block => ({
    id,
    name: id,
    colour: '#64748b',
    weekday: 1,
    start: 9 * 60,
    end: 17 * 60,
    from: W0,
    routineIds: [],
    createdAt: t0,
    updatedAt: t0,
    ...rest,
  })
  const placement = (id: string, taskId: string, rest: Partial<Placement>): Placement => ({
    id,
    taskId,
    date: W0,
    createdAt: t0,
    updatedAt: t0,
    ...rest,
  })
  const stored = <T>(kind: string, id: string) => records.rows.get(`${kind}:${id}`)!.data as T
  const isGone = (kind: string, id: string) => records.rows.get(`${kind}:${id}`)!.deleted
  const liveBlocks = () => [...records.rows.values()].filter((r) => r.kind === 'block' && !r.deleted).map((r) => r.data as Block)
  const ids = (blocks: Block[]) => blocks.map((b) => b.id)

  beforeEach(async () => {
    await records.put([
      // Standing since last week, Mondays, with the Gym routine in it.
      liveRow('block', 'job', block('job', { name: 'Job', from: W_1, routineIds: ['r2'], colour: '#4f6fd8' })),
      // One-off this week, Wednesday.
      liveRow('block', 'gym', block('gym', { name: 'Gym', weekday: 3, start: 10 * 60, end: 11 * 60, until: W1 })),
      // Last week's Job placement, this week's, and next week's (timed).
      liveRow('placement', 'p0', placement('p0', 'b', { blockId: 'job', date: W_1 })),
      liveRow('placement', 'p1', placement('p1', 'a', { blockId: 'job', date: W0 })),
      liveRow('placement', 'p2', placement('p2', 'a', { blockId: 'job', date: W1, start: 9 * 60, end: 10 * 60 })),
    ])
  })

  it('list_blocks shows the week in force, Monday first, with ids, dates, carry and routines', async () => {
    const { data } = await call('list_blocks')
    expect(data.week).toBe(W0)
    expect(data.blocks).toEqual([
      { id: 'job', name: 'Job', colour: 'blue', day: 'Mon', date: W0, start: '09:00', end: '17:00', carry: true, routines: ['Gym'] },
      { id: 'gym', name: 'Gym', colour: 'slate', day: 'Wed', date: '2026-09-16', start: '10:00', end: '11:00', carry: false, routines: [] },
    ])
    // Next week: the one-off is gone; the standing one is still there.
    const next = await call('list_blocks', { week: '2026-09-25' })
    expect(ids(next.data.blocks)).toEqual(['job'])
    expect(next.data.blocks[0].date).toBe(W1)
  })

  it('create_block is one-off by default, snaps times, and reuses the colour of its name', async () => {
    const { data } = await call('create_block', { name: 'Job', date: '2026-09-22', start: '08:05', end: '12:10' })
    expect(data).toMatchObject({ name: 'Job', colour: 'blue', day: 'Tue', date: '2026-09-22', start: '08:00', end: '12:15', carry: false })
    const b = stored<Block>('block', data.id)
    expect(b).toMatchObject({ weekday: 2, start: 480, end: 735, from: W1, until: '2026-09-28', routineIds: [] })
    sameDay(b.updatedAt)
  })

  it('create_block makes a standing Block with routines by title and a colour by name', async () => {
    const { data } = await call('create_block', {
      name: 'Morning',
      date: TODAY,
      start: '06:00',
      end: '08:00',
      carry: true,
      colour: 'amber',
      routines: ['read 20 pages'],
    })
    expect(data).toMatchObject({ day: 'Sun', carry: true, colour: 'amber', routines: ['Read 20 pages'] })
    expect(stored<Block>('block', data.id)).toMatchObject({ weekday: 0, from: W0, routineIds: ['r1'] })
    expect('until' in stored<Block>('block', data.id)).toBe(false)
  })

  it('create_block picks a free palette colour for a new name', async () => {
    const { data } = await call('create_block', { name: 'Sleep', date: TODAY, start: '22:00', end: '24:00' })
    // slate and blue are taken by Gym and Job.
    expect(data.colour).toBe('red')
    expect(data.end).toBe('24:00')
  })

  it('create_block refuses an empty span and an unknown routine', async () => {
    const bad = await call('create_block', { name: 'X', date: TODAY, start: '10:00', end: '10:05' })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('end after it starts')
    const who = await call('create_block', { name: 'X', date: TODAY, start: '10:00', end: '11:00', routines: ['Yoga'] })
    expect(who.isError).toBe(true)
    expect(who.text).toContain('No Routine called "Yoga"')
  })

  it('update_block patches a version that starts this week in place', async () => {
    const { data } = await call('update_block', { id: 'gym', name: 'Lift', start: '10:30', colour: 'green', routines: ['Gym'] })
    expect(data).toMatchObject({ id: 'gym', name: 'Lift', colour: 'green', start: '10:30', end: '11:00', routines: ['Gym'] })
    expect(liveBlocks()).toHaveLength(2)
    expect(stored<Block>('block', 'gym')).toMatchObject({ name: 'Lift', start: 630, routineIds: ['r2'], until: W1 })
  })

  it('update_block splits a standing Block that started earlier (TB-5, D8) and re-points placements from that week', async () => {
    const { data } = await call('update_block', { id: 'job', end: '16:00' })
    expect(data.id).not.toBe('job')
    expect(data).toMatchObject({ name: 'Job', end: '16:00', carry: true, routines: ['Gym'] })
    // Past version keeps its id and ends at this week; the future one starts here.
    expect(stored<Block>('block', 'job')).toMatchObject({ end: 17 * 60, until: W0 })
    expect(stored<Block>('block', data.id)).toMatchObject({ end: 16 * 60, from: W0 })
    expect('until' in stored<Block>('block', data.id)).toBe(false)
    expect(stored<Placement>('placement', 'p0').blockId).toBe('job')
    expect(stored<Placement>('placement', 'p1').blockId).toBe(data.id)
    expect(stored<Placement>('placement', 'p2').blockId).toBe(data.id)
    expect(data.placementsChanged).toBe(2)
    // Listing next week shows only the new version.
    expect(ids((await call('list_blocks', { week: W1 })).data.blocks)).toEqual([data.id])
  })

  it('update_block from a later week leaves this week alone', async () => {
    const { data } = await call('update_block', { id: 'job', from: '2026-09-23', name: 'Work' })
    expect((await call('list_blocks')).data.blocks[0]).toMatchObject({ id: 'job', name: 'Job' })
    expect((await call('list_blocks', { week: W1 })).data.blocks[0]).toMatchObject({ id: data.id, name: 'Work' })
    expect(stored<Placement>('placement', 'p1').blockId).toBe('job')
    expect(stored<Placement>('placement', 'p2').blockId).toBe(data.id)
  })

  it('update_block moves the placed Tasks along when the weekday changes', async () => {
    const { data } = await call('update_block', { id: 'job', weekday: 'thu' })
    expect(data).toMatchObject({ day: 'Thu', date: '2026-09-17' })
    expect(stored<Placement>('placement', 'p0').date).toBe(W_1)
    expect(stored<Placement>('placement', 'p1').date).toBe('2026-09-17')
    expect(stored<Placement>('placement', 'p2').date).toBe('2026-09-24')
    // The Task follows its earliest placement (D9).
    expect(stored<Task>('task', 'a').scheduled).toBe('2026-09-17')
  })

  it('update_block turns carry off from a week on and unlinks what was in the weeks it drops', async () => {
    const { data } = await call('update_block', { id: 'job', carry: false })
    expect(data).toMatchObject({ carry: false })
    expect(stored<Block>('block', data.id).until).toBe(W1)
    // Next week's timed placement keeps its hour and loses the link; this week's stays.
    expect(stored<Placement>('placement', 'p2')).toMatchObject({ start: 540, end: 600 })
    expect('blockId' in stored<Placement>('placement', 'p2')).toBe(false)
    expect(stored<Placement>('placement', 'p1').blockId).toBe(data.id)
    expect((await call('list_blocks', { week: W1 })).data.blocks).toEqual([])
  })

  it('update_block turns carry on', async () => {
    const { data } = await call('update_block', { id: 'gym', carry: true })
    expect(data.carry).toBe(true)
    expect(ids((await call('list_blocks', { week: '2026-10-30' })).data.blocks)).toContain('gym')
  })

  it('update_block refuses a week the version had already ended before, and unknown ids', async () => {
    const ended = await call('update_block', { id: 'gym', from: W1, name: 'x' })
    expect(ended.isError).toBe(true)
    expect(ended.text).toContain('already ended')
    expect((await call('update_block', { id: 'nope', name: 'x' })).isError).toBe(true)
  })

  it('delete_block ends a standing Block from this week on and removes its placements from then', async () => {
    const { data } = await call('delete_block', { id: 'job' })
    expect(data).toEqual({ id: 'job', name: 'Job', removedFrom: W0, placementsRemoved: 2 })
    expect(stored<Block>('block', 'job').until).toBe(W0)
    expect(isGone('placement', 'p0')).toBe(false)
    expect(isGone('placement', 'p1')).toBe(true)
    expect(isGone('placement', 'p2')).toBe(true)
    expect(ids((await call('list_blocks')).data.blocks)).toEqual(['gym'])
    expect(ids((await call('list_blocks', { week: W_1 })).data.blocks)).toEqual(['job'])
  })

  it('delete_block deletes outright a Block that starts in that week', async () => {
    const { data } = await call('delete_block', { id: 'gym' })
    expect(data).toEqual({ id: 'gym', name: 'Gym', deleted: true })
    expect(isGone('block', 'gym')).toBe(true)
  })

  it('delete_block from a later week keeps this week', async () => {
    const { data } = await call('delete_block', { id: 'job', from: W1 })
    expect(data).toMatchObject({ removedFrom: W1, placementsRemoved: 1 })
    expect(isGone('placement', 'p1')).toBe(false)
    expect(isGone('placement', 'p2')).toBe(true)
    expect(ids((await call('list_blocks')).data.blocks)).toEqual(['job', 'gym'])
  })

  it('delete_block everywhere buries the version; timed placements keep their hour, untimed ones go', async () => {
    const { data } = await call('delete_block', { id: 'job', everywhere: true })
    expect(data).toEqual({ id: 'job', name: 'Job', deleted: true, placementsChanged: 1, placementsRemoved: 2 })
    expect(isGone('block', 'job')).toBe(true)
    expect(isGone('placement', 'p0')).toBe(true)
    expect(isGone('placement', 'p1')).toBe(true)
    expect(stored<Placement>('placement', 'p2')).toMatchObject({ start: 540, end: 600 })
    expect('blockId' in stored<Placement>('placement', 'p2')).toBe(false)
    expect((await call('list_blocks', { week: W_1 })).data.blocks).toEqual([])
  })

  it('delete_block refuses a week the version had already ended before, unless everywhere', async () => {
    const ended = await call('delete_block', { id: 'gym', from: W1 })
    expect(ended.isError).toBe(true)
    expect(ended.text).toContain('everywhere')
    expect((await call('delete_block', { id: 'gym', from: W1, everywhere: true })).data.deleted).toBe(true)
  })
})

describe('placements (PD-7)', () => {
  const W0 = '2026-09-14'
  const t0 = '2026-09-01T00:00:00.000Z'
  const job: Block = { id: 'job', name: 'Job', colour: '#4f6fd8', weekday: 1, start: 9 * 60, end: 17 * 60, from: W0, routineIds: [], createdAt: t0, updatedAt: t0 }
  const stored = <T>(kind: string, id: string) => records.rows.get(`${kind}:${id}`)!.data as T

  beforeEach(async () => {
    await records.put([liveRow('block', 'job', job)])
  })

  it('place_task in a Block by name sets Scheduled to that day', async () => {
    const { data } = await call('place_task', { id: 'a', date: W0, block: 'job' })
    expect(data).toMatchObject({ date: W0, block: 'Job', blockId: 'job', scheduled: W0, task: { id: 'a' } })
    expect(data.start).toBeUndefined()
    expect(stored<Task>('task', 'a').scheduled).toBe(W0)
    expect(stored<Placement>('placement', data.id)).toMatchObject({ taskId: 'a', date: W0, blockId: 'job' })
  })

  it('place_task at an hour is as long as the Estimate, else an hour, never past the Block (PD-2)', async () => {
    await call('update_task', { id: 'a', estimate: 90 })
    const sized = (await call('place_task', { id: 'a', date: W0, start: '10:00' })).data
    expect([sized.start, sized.end]).toEqual(['10:00', '11:30'])
    const plain = (await call('place_task', { id: 'b', date: W0, start: '10:07' })).data
    expect([plain.start, plain.end]).toEqual(['10:00', '11:00'])
    const clipped = (await call('place_task', { id: 'a', date: W0, block: 'Job', start: '16:30' })).data
    expect([clipped.start, clipped.end, clipped.block]).toEqual(['16:30', '17:00', 'Job'])
    const drawn = (await call('place_task', { id: 'a', date: W0, start: '13:00', end: '13:15' })).data
    expect([drawn.start, drawn.end]).toEqual(['13:00', '13:15'])
  })

  it('place_task refuses neither block nor hour, an unknown Block on that day, and an unknown Task', async () => {
    expect((await call('place_task', { id: 'a', date: W0 })).isError).toBe(true)
    const wrongDay = await call('place_task', { id: 'a', date: '2026-09-15', block: 'Job' })
    expect(wrongDay.isError).toBe(true)
    expect(wrongDay.text).toContain('(none)')
    expect((await call('place_task', { id: 'zzz', date: W0, block: 'Job' })).isError).toBe(true)
  })

  it('Scheduled follows the earliest Placement and is never cleared (D9, TB-17)', async () => {
    const later = (await call('place_task', { id: 'a', date: '2026-09-16', start: '09:00' })).data
    expect(stored<Task>('task', 'a').scheduled).toBe('2026-09-16')
    const earlier = (await call('place_task', { id: 'a', date: W0, block: 'Job' })).data
    expect(stored<Task>('task', 'a').scheduled).toBe(W0)
    const gone = (await call('unplace', { id: earlier.id })).data
    expect(gone).toEqual({ id: earlier.id, removed: true, task: 'Overdue report', scheduled: '2026-09-16' })
    expect(stored<Task>('task', 'a').scheduled).toBe('2026-09-16')
    await call('unplace', { id: later.id })
    expect(stored<Task>('task', 'a').scheduled).toBe('2026-09-16')
    expect(records.rows.get(`placement:${later.id}`)!.deleted).toBe(true)
    expect((await call('unplace', { id: later.id })).isError).toBe(true)
  })

  it('list_placements covers this week by default, in day and hour order', async () => {
    await call('place_task', { id: 'a', date: '2026-09-16', start: '14:00' })
    await call('place_task', { id: 'b', date: '2026-09-16', start: '09:00' })
    await call('place_task', { id: 'b', date: W0, block: 'Job' })
    await call('place_task', { id: 'b', date: '2026-09-21', start: '09:00' })
    const { data } = await call('list_placements')
    expect([data.from, data.to, data.count]).toEqual([W0, '2026-09-20', 3])
    expect(data.placements.map((p: { date: string; start?: string }) => [p.date, p.start])).toEqual([
      [W0, undefined],
      ['2026-09-16', '09:00'],
      ['2026-09-16', '14:00'],
    ])
    expect((await call('list_placements', { from: '2026-09-21', to: '2026-09-21' })).data.count).toBe(1)
  })

  it('update_placement moves the day, keeps the length on a new start, drops a Block the new day lacks, and refuses emptiness', async () => {
    const p = (await call('place_task', { id: 'a', date: W0, block: 'Job', start: '10:00', end: '11:30' })).data
    const moved = (await call('update_placement', { id: p.id, start: '14:00' })).data
    expect([moved.start, moved.end, moved.block]).toEqual(['14:00', '15:30', 'Job'])
    const tuesday = (await call('update_placement', { id: p.id, date: '2026-09-15' })).data
    expect(tuesday.block).toBeUndefined()
    expect([tuesday.date, tuesday.start]).toEqual(['2026-09-15', '14:00'])
    expect((await call('update_placement', { id: p.id, start: null })).isError).toBe(true)
    const back = (await call('update_placement', { id: p.id, date: W0, block: 'job', start: null })).data
    expect(back).toMatchObject({ date: W0, block: 'Job' })
    expect(back.start).toBeUndefined()
    expect(stored<Task>('task', 'a').scheduled).toBe(W0)
  })
})

describe('week_review (PD-12, PD-13)', () => {
  it('reports done by Space, Routine ratios and stale Placements for the week', async () => {
    await call('update_task', { id: 'a', status: 'done' })
    const p = (await call('place_task', { id: 'b', date: '2026-09-16', start: '09:00' })).data
    await call('place_task', { id: 'b', date: TODAY, start: '09:00' }) // today: not stale yet
    const { data } = await call('week_review')
    expect(data.week).toBe('2026-09-14')
    expect(data.summary).toBe('1 done · Routines 1/10 · 1 stale')
    expect(data.done).toEqual([{ space: 'Work', tasks: [expect.objectContaining({ id: 'a' })] }])
    expect(data.routines).toEqual([
      { id: 'r1', title: 'Read 20 pages', checked: 1, scheduled: 7 },
      { id: 'r2', title: 'Gym', checked: 0, scheduled: 3 },
    ])
    expect(data.stale).toEqual([{ placementId: p.id, date: '2026-09-16', start: '09:00', end: '10:00', task: expect.objectContaining({ id: 'b' }) }])
    // 'c' was finished on 10 Sep in the seed.
    expect((await call('week_review', { week: '2026-09-07' })).data.summary).toBe('1 done · Routines 0/10')
  })
})

describe('prompts (PD-11)', () => {
  it('offers plan_day and close_day', async () => {
    const { prompts } = await client.listPrompts()
    expect(prompts.map((p) => p.name).sort()).toEqual(['close_day', 'plan_day'])
    const { messages } = await client.getPrompt({ name: 'plan_day', arguments: { date: '2026-09-21' } })
    expect((messages[0].content as { text: string }).text).toContain('date 2026-09-21')
    const close = await client.getPrompt({ name: 'close_day', arguments: {} })
    expect((close.messages[0].content as { text: string }).text).toContain('update_task')
  })
})
