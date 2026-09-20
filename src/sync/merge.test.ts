import { describe, expect, it } from 'vitest'
import { applyRemote, fromRows, mergeRows, toRows, type SyncRow } from './merge'
import type { Snapshot } from '../store/repository'
import type { Task } from '../domain/task'
import { defaultSpace, DEFAULT_SPACE_ID } from '../domain/space'
import type { RoutineRecord } from '../domain/routine'
import { BLOCK_COLOURS, type Block, type Placement } from '../domain/block'

const T = (n: number) => `2026-09-20T10:00:${String(n).padStart(2, '0')}.000Z`

const task = (id: string, updatedAt: string, extra: Partial<Task> = {}): Task => ({
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
  updatedAt,
  ...extra,
})

const routine = (id: string, updatedAt: string): RoutineRecord => ({
  id,
  title: id,
  schedule: { kind: 'daily' },
  note: '',
  archived: false,
  createdAt: T(0),
  updatedAt,
})

const block = (id: string, updatedAt: string, extra: Partial<Block> = {}): Block => ({
  id,
  name: 'Job',
  colour: BLOCK_COLOURS[0],
  weekday: 3,
  start: 540,
  end: 1020,
  from: '2026-09-14',
  routineIds: [],
  createdAt: T(0),
  updatedAt,
  ...extra,
})

const placement = (id: string, updatedAt: string, extra: Partial<Placement> = {}): Placement => ({
  id,
  taskId: 'a',
  date: '2026-09-16',
  createdAt: T(0),
  updatedAt,
  ...extra,
})

const snapshot = (partial: Partial<Snapshot> = {}): Snapshot => ({
  tasks: [],
  spaces: [defaultSpace()],
  routines: [],
  checkIns: [],
  blocks: [],
  placements: [],
  tombstones: [],
  ...partial,
})

const row = (kind: SyncRow['kind'], id: string, updatedAt: string, data: unknown): SyncRow => ({
  kind,
  id,
  updatedAt,
  deleted: false,
  data,
})
const gone = (kind: SyncRow['kind'], id: string, updatedAt: string): SyncRow => ({
  kind,
  id,
  updatedAt,
  deleted: true,
  data: null,
})

describe('toRows / fromRows', () => {
  it('round-trips a snapshot', () => {
    const s = snapshot({
      tasks: [task('a', T(1))],
      routines: [routine('r', T(1))],
      checkIns: [{ routineId: 'r', date: '2026-09-20', updatedAt: T(2) }],
      blocks: [block('b', T(1), { routineIds: ['r'], until: '2026-09-28' })],
      placements: [placement('p', T(1), { blockId: 'b' }), placement('q', T(2), { start: 600, end: 660 })],
      tombstones: [{ kind: 'task', id: 'z', deletedAt: T(3) }],
    })
    expect(fromRows(toRows(s))).toEqual(s)
  })

  it('emits block and placement rows under their own kinds', () => {
    const rows = toRows(snapshot({ blocks: [block('b', T(1))], placements: [placement('p', T(2), { blockId: 'b' })] }))
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual(['space:personal', 'block:b', 'placement:p'])
  })
})

describe('mergeRows — last writer wins per row', () => {
  it('keeps the newer of two versions of the same row', () => {
    const older = row('task', 'a', T(1), task('a', T(1), { title: 'old' }))
    const newer = row('task', 'a', T(2), task('a', T(2), { title: 'new' }))
    expect(mergeRows([older], [newer])).toEqual([newer])
    expect(mergeRows([newer], [older])).toEqual([newer])
  })

  it('keeps the local row on an exact tie', () => {
    const local = row('task', 'a', T(1), { marker: 'local' })
    const remote = row('task', 'a', T(1), { marker: 'remote' })
    expect(mergeRows([local], [remote])).toEqual([local])
  })

  it('edits to different rows on two Devices both survive', () => {
    const local = [row('task', 'a', T(2), 'a-local'), row('task', 'b', T(1), 'b')]
    const remote = [row('task', 'a', T(1), 'a'), row('task', 'b', T(2), 'b-remote')]
    const merged = new Map(mergeRows(local, remote).map((r) => [r.id, r.data]))
    expect(merged.get('a')).toBe('a-local')
    expect(merged.get('b')).toBe('b-remote')
  })

  it('a later deletion beats an earlier edit, and a later edit beats an earlier deletion', () => {
    const edit = row('task', 'a', T(1), 'a')
    const del = gone('task', 'a', T(2))
    expect(mergeRows([edit], [del])).toEqual([del])
    const laterEdit = row('task', 'a', T(3), 'a-again')
    expect(mergeRows([del], [laterEdit])).toEqual([laterEdit])
  })
})

describe('applyRemote — scenarios from the design agreement', () => {
  it('a Check-in made offline on one Device and another made elsewhere both stay made', () => {
    const local = snapshot({
      routines: [routine('r', T(0))],
      checkIns: [{ routineId: 'r', date: '2026-09-14', updatedAt: T(1) }], // phone, Monday
    })
    const remote = [row('checkin', 'r:2026-09-15', T(2), { routineId: 'r', date: '2026-09-15', updatedAt: T(2) })] // laptop, Tuesday
    expect(applyRemote(local, remote).checkIns.map((c) => c.date).sort()).toEqual(['2026-09-14', '2026-09-15'])
  })

  it('an explicit uncheck removes a Check-in made earlier elsewhere', () => {
    const local = snapshot({
      routines: [routine('r', T(0))],
      checkIns: [{ routineId: 'r', date: '2026-09-14', updatedAt: T(1) }],
    })
    expect(applyRemote(local, [gone('checkin', 'r:2026-09-14', T(2))]).checkIns).toEqual([])
  })

  it('a Task whose Space was deleted on another Device moves to Personal', () => {
    const local = snapshot({
      spaces: [defaultSpace(), { id: 'work', name: 'Work', colour: '#000', order: 1, updatedAt: T(0) }],
      tasks: [task('a', T(1), { spaceId: 'work' })],
    })
    const merged = applyRemote(local, [gone('space', 'work', T(2))])
    expect(merged.spaces.map((s) => s.id)).toEqual([DEFAULT_SPACE_ID])
    expect(merged.tasks[0].spaceId).toBe(DEFAULT_SPACE_ID)
  })

  it('Check-ins of a Routine deleted elsewhere go with it', () => {
    const local = snapshot({
      routines: [routine('r', T(0))],
      checkIns: [{ routineId: 'r', date: '2026-09-14', updatedAt: T(1) }],
    })
    const merged = applyRemote(local, [gone('routine', 'r', T(2))])
    expect(merged.routines).toEqual([])
    expect(merged.checkIns).toEqual([])
  })

  it('a Placement of a Task deleted elsewhere is dropped', () => {
    const local = snapshot({
      tasks: [task('a', T(0))],
      placements: [placement('p', T(1), { start: 600, end: 660 })],
    })
    expect(applyRemote(local, [gone('task', 'a', T(2))]).placements).toEqual([])
  })

  it('a Placement whose Block was deleted elsewhere keeps its hour, or goes when it has none', () => {
    const local = snapshot({
      tasks: [task('a', T(0))],
      blocks: [block('b', T(0))],
      placements: [
        placement('timed', T(1), { blockId: 'b', start: 600, end: 660 }),
        placement('untimed', T(1), { blockId: 'b' }),
        placement('elsewhere', T(1), { blockId: 'other' }),
      ],
    })
    const merged = applyRemote(
      local,
      [gone('block', 'b', T(2)), row('block', 'other', T(2), block('other', T(2)))],
    )
    expect(merged.placements).toEqual([
      { id: 'timed', taskId: 'a', date: '2026-09-16', start: 600, end: 660, createdAt: T(0), updatedAt: T(1) },
      placement('elsewhere', T(1), { blockId: 'other' }),
    ])
    expect('blockId' in merged.placements[0]).toBe(false)
  })

  it('a Block forgets a Routine deleted elsewhere, and keeps the rest', () => {
    const local = snapshot({
      routines: [routine('r', T(0)), routine('s', T(0))],
      blocks: [block('b', T(1), { routineIds: ['r', 's'] })],
    })
    const merged = applyRemote(local, [gone('routine', 'r', T(2))])
    expect(merged.blocks[0].routineIds).toEqual(['s'])
    expect(merged.blocks[0].updatedAt).toBe(T(1))
  })

  it('a Block edited on one Device and its Placement made on another both arrive', () => {
    const local = snapshot({
      tasks: [task('a', T(0))],
      blocks: [block('b', T(1), { start: 540 })],
    })
    const remote = [
      row('block', 'b', T(2), block('b', T(2), { start: 510 })),
      row('placement', 'p', T(2), placement('p', T(2), { blockId: 'b' })),
    ]
    const merged = applyRemote(local, remote)
    expect(merged.blocks[0].start).toBe(510)
    expect(merged.placements.map((p) => p.id)).toEqual(['p'])
  })

  it('Personal can never be deleted', () => {
    const merged = applyRemote(snapshot(), [gone('space', DEFAULT_SPACE_ID, T(9))])
    expect(merged.spaces.map((s) => s.id)).toEqual([DEFAULT_SPACE_ID])
    expect(merged.tombstones).toEqual([])
  })

  it('an empty server changes nothing, so the first Device seeds it with what it has', () => {
    const local = snapshot({ tasks: [task('a', T(1))] })
    expect(applyRemote(local, [])).toEqual(local)
  })
})
