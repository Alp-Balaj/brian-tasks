import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageRepository, type Snapshot } from './repository'
import { defaultSpace } from '../domain/space'

/** A stand-in for the browser's localStorage, so the upgrade chain runs under Node. */
function fakeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    keys: () => [...store.keys()],
  }
}

const T = '2026-09-20T10:00:00.000Z'

/** What a Device on the previous build has on disk: no blocks, no placements. */
const v3 = {
  tasks: [{ id: 't', title: 't', description: '', status: 'todo', priority: 'normal', tags: [], order: 0, spaceId: 'personal', archived: false, pinned: false, createdAt: T, updatedAt: T }],
  spaces: [defaultSpace()],
  routines: [{ id: 'r', title: 'r', schedule: { kind: 'daily' }, note: '', archived: false, createdAt: T, updatedAt: T }],
  checkIns: [{ routineId: 'r', date: '2026-09-20', updatedAt: T }],
  tombstones: [{ kind: 'task', id: 'gone', deletedAt: T }],
}

let storage: ReturnType<typeof fakeStorage>
beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

describe('localStorageRepository — on-device upgrades', () => {
  it('v3 → v4 keeps everything and adds empty blocks and placements, saved under the v4 key', async () => {
    storage.setItem('brian-tasks:v3', JSON.stringify(v3))
    const loaded = await localStorageRepository.load()
    expect(loaded).toEqual({ ...v3, blocks: [], placements: [] })
    expect(storage.keys().sort()).toEqual(['brian-tasks:v3', 'brian-tasks:v4'])
    expect(JSON.parse(storage.getItem('brian-tasks:v4')!)).toEqual(loaded)
  })

  it('a v4 store is loaded as it is, with its blocks and placements', async () => {
    const snapshot: Snapshot = {
      ...v3,
      blocks: [{ id: 'b', name: 'Job', colour: '#64748b', weekday: 3, start: 540, end: 1020, from: '2026-09-14', routineIds: [], createdAt: T, updatedAt: T }],
      placements: [{ id: 'p', taskId: 't', date: '2026-09-16', blockId: 'b', createdAt: T, updatedAt: T }],
    } as Snapshot
    storage.setItem('brian-tasks:v4', JSON.stringify(snapshot))
    expect(await localStorageRepository.load()).toEqual(snapshot)
  })

  it('v2 chains through v3 to v4', async () => {
    storage.setItem('brian-tasks:v2', JSON.stringify({ tasks: [], spaces: [{ id: 'personal', name: 'Personal', colour: '#2f6f5e', order: 0 }], routines: [] }))
    const loaded = await localStorageRepository.load()
    expect(loaded).toMatchObject({ tasks: [], routines: [], checkIns: [], tombstones: [], blocks: [], placements: [] })
    expect(loaded!.spaces[0].updatedAt).toBeTypeOf('string')
    expect(storage.getItem('brian-tasks:v4')).not.toBeNull()
  })

  it('nothing stored means null (first run)', async () => {
    expect(await localStorageRepository.load()).toBeNull()
  })
})
