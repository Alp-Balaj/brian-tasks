import { beforeEach, describe, expect, it } from 'vitest'
import { useBlocks } from './blocks'
import { useTasks } from './tasks'
import { useTombstones } from './tombstones'
import { BLOCK_COLOURS, appliesTo, blocksOn, carries, type Block, type NewBlock } from '../domain/block'
import { buildTask, type Task } from '../domain/task'

// Weeks: W0 = Mon 2026-09-14, W1 = Mon 2026-09-21, W2 = Mon 2026-09-28.
const W0 = '2026-09-14'
const W1 = '2026-09-21'
const W2 = '2026-09-28'
const WED0 = '2026-09-16'
const WED1 = '2026-09-23'
const WED2 = '2026-09-30'
const THU1 = '2026-09-24'

const JOB: NewBlock = { name: 'Job', colour: BLOCK_COLOURS[0], weekday: 3, start: 540, end: 1020, week: W0, carry: true }

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  ...buildTask({ title: id }, id, [], '2026-09-01T10:00:00.000Z'),
  ...extra,
})

const blocks = () => useBlocks.getState().blocks
const placements = () => useBlocks.getState().placements
const scheduledOf = (id: string) => useTasks.getState().tasks.find((t) => t.id === id)?.scheduled
const tombstones = () => useTombstones.getState().tombstones.map((t) => `${t.kind}:${t.id}`)

beforeEach(() => {
  useBlocks.setState({ blocks: [], placements: [] })
  useTasks.setState({ tasks: [task('a'), task('b'), task('c', { scheduled: W0 })] })
  useTombstones.setState({ tombstones: [] })
})

describe('addBlock', () => {
  it('is one-off by default (TB-4): until is the following week', () => {
    const b = useBlocks.getState().addBlock({ ...JOB, carry: undefined })
    expect(b.until).toBe(W1)
    expect(carries(b)).toBe(false)
    expect(appliesTo(b, W0)).toBe(true)
    expect(appliesTo(b, W1)).toBe(false)
  })
  it('carry on makes it standing', () => {
    const b = useBlocks.getState().addBlock(JOB)
    expect(b.until).toBeUndefined()
    expect(b.routineIds).toEqual([])
    expect(blocks()).toEqual([b])
  })
})

describe('updateBlockFrom (TB-5)', () => {
  it('patches in place when the version starts in that week', () => {
    const b = useBlocks.getState().addBlock(JOB)
    useBlocks.getState().updateBlockFrom(b.id, W0, { start: 510 })
    expect(blocks()).toHaveLength(1)
    expect(blocks()[0].start).toBe(510)
  })

  it('splits once and re-points only placements with date >= week', () => {
    const { addBlock, addPlacement, updateBlockFrom } = useBlocks.getState()
    const b = addBlock(JOB)
    const before = addPlacement({ taskId: 'a', date: WED0, blockId: b.id })
    const inWeek = addPlacement({ taskId: 'b', date: WED1, blockId: b.id })
    const after = addPlacement({ taskId: 'a', date: WED2, blockId: b.id })

    updateBlockFrom(b.id, W1, { start: 510 })

    expect(blocks()).toHaveLength(2)
    const past = blocks().find((x) => x.id === b.id)!
    const future = blocks().find((x) => x.id !== b.id)!
    expect(past).toMatchObject({ start: 540, from: W0, until: W1 })
    expect(future).toMatchObject({ start: 510, from: W1, name: 'Job' })
    expect(future.until).toBeUndefined()
    expect(blocksOn(blocks(), WED0).map((x) => x.id)).toEqual([b.id])
    expect(blocksOn(blocks(), WED1).map((x) => x.id)).toEqual([future.id])

    const byId = new Map(placements().map((p) => [p.id, p]))
    expect(byId.get(before.id)!.blockId).toBe(b.id)
    expect(byId.get(inWeek.id)!.blockId).toBe(future.id)
    expect(byId.get(after.id)!.blockId).toBe(future.id)
    // Re-pointed rows carry a fresh updatedAt, or other Devices never learn the new link.
    expect(byId.get(inWeek.id)!.updatedAt >= inWeek.updatedAt).toBe(true)

    // A second edit in the same week lands on the future version — no second split.
    updateBlockFrom(future.id, W1, { end: 1080 })
    expect(blocks()).toHaveLength(2)
    expect(blocks().find((x) => x.id === future.id)!.end).toBe(1080)
  })

  it('does nothing for a week the version had already ended before', () => {
    const b = useBlocks.getState().addBlock({ ...JOB, carry: false })
    expect(useBlocks.getState().updateBlockFrom(b.id, W2, { start: 510 })).toBeUndefined()
    expect(blocks()).toEqual([b])
  })

  it('returns the id of the version the change landed on, so an open sheet can follow a split', () => {
    const { addBlock, updateBlockFrom, setCarry } = useBlocks.getState()
    const b = addBlock(JOB)
    expect(updateBlockFrom(b.id, W0, { start: 510 })).toBe(b.id)
    const futureId = updateBlockFrom(b.id, W1, { start: 480 })!
    expect(futureId).not.toBe(b.id)
    expect(blocks().find((x) => x.id === futureId)).toMatchObject({ from: W1, start: 480 })
    // The next edit through the returned id patches in place.
    expect(updateBlockFrom(futureId, W1, { end: 1080 })).toBe(futureId)
    expect(blocks()).toHaveLength(2)
    // setCarry follows the same rule, including when it is a no-op.
    expect(setCarry(futureId, W1, true)).toBe(futureId)
    const laterId = setCarry(futureId, W2, false)!
    expect(laterId).not.toBe(futureId)
    expect(blocks().find((x) => x.id === laterId)).toMatchObject({ from: W2, until: '2026-10-05' })
  })

  it('moving the block to another weekday moves its placements with it', () => {
    const { addBlock, addPlacement, updateBlockFrom } = useBlocks.getState()
    const b = addBlock(JOB)
    const p = addPlacement({ taskId: 'a', date: WED1, blockId: b.id })
    updateBlockFrom(b.id, W1, { weekday: 4 })
    const moved = placements().find((x) => x.id === p.id)!
    expect(moved.date).toBe(THU1)
    expect(scheduledOf('a')).toBe(THU1)
  })

  it('trims the name', () => {
    const b = useBlocks.getState().addBlock(JOB)
    useBlocks.getState().updateBlockFrom(b.id, W0, { name: '  Deep work ' })
    expect(blocks()[0].name).toBe('Deep work')
  })
})

describe('setCarry (TB-4, TB-5)', () => {
  it('off in week W leaves W and removes W+1', () => {
    const b = useBlocks.getState().addBlock(JOB)
    useBlocks.getState().setCarry(b.id, W0, false)
    const only = blocks()[0]
    expect(blocks()).toHaveLength(1)
    expect(only.until).toBe(W1)
    expect(appliesTo(only, W0)).toBe(true)
    expect(appliesTo(only, W1)).toBe(false)
  })

  it('off in a later week splits: the past keeps carrying up to W, the future ends after W', () => {
    const b = useBlocks.getState().addBlock(JOB)
    useBlocks.getState().setCarry(b.id, W1, false)
    const past = blocks().find((x) => x.id === b.id)!
    const future = blocks().find((x) => x.id !== b.id)!
    expect(past.until).toBe(W1)
    expect(future).toMatchObject({ from: W1, until: W2 })
    expect(blocksOn(blocks(), WED0)).toHaveLength(1)
    expect(blocksOn(blocks(), WED1)).toHaveLength(1)
    expect(blocksOn(blocks(), WED2)).toHaveLength(0)
  })

  it('off unlinks the placements in the weeks it no longer covers', () => {
    const { addBlock, addPlacement, setCarry } = useBlocks.getState()
    const b = addBlock(JOB)
    const kept = addPlacement({ taskId: 'a', date: WED0, blockId: b.id })
    const untimed = addPlacement({ taskId: 'a', date: WED1, blockId: b.id })
    const timed = addPlacement({ taskId: 'b', date: WED1, blockId: b.id, start: 600, end: 660 })
    setCarry(b.id, W0, false)
    const byId = new Map(placements().map((p) => [p.id, p]))
    expect(byId.get(kept.id)!.blockId).toBe(b.id)
    expect(byId.has(untimed.id)).toBe(false)
    expect(byId.get(timed.id)!.blockId).toBeUndefined()
    expect(byId.get(timed.id)).toMatchObject({ start: 600, end: 660 })
    expect(tombstones()).toEqual([`placement:${untimed.id}`])
  })

  it('on clears until', () => {
    const b = useBlocks.getState().addBlock({ ...JOB, carry: false })
    useBlocks.getState().setCarry(b.id, W0, true)
    expect(blocks()[0].until).toBeUndefined()
    expect('until' in blocks()[0]).toBe(false)
    expect(carries(blocks()[0])).toBe(true)
  })
})

describe('endBlock ("Remove from this week on")', () => {
  it('ends the version at the week and removes its placements from then on', () => {
    const { addBlock, addPlacement, endBlock } = useBlocks.getState()
    const b = addBlock(JOB)
    const before = addPlacement({ taskId: 'a', date: WED0, blockId: b.id })
    const timed = addPlacement({ taskId: 'b', date: WED1, blockId: b.id, start: 600, end: 660 })
    endBlock(b.id, W1)
    expect(blocks()).toHaveLength(1)
    expect(blocks()[0].until).toBe(W1)
    expect(placements().map((p) => p.id)).toEqual([before.id])
    expect(tombstones()).toEqual([`placement:${timed.id}`])
  })
  it('deletes a version that starts in that week', () => {
    const b = useBlocks.getState().addBlock({ ...JOB, week: W1 })
    useBlocks.getState().endBlock(b.id, W1)
    expect(blocks()).toEqual([])
    expect(tombstones()).toEqual([`block:${b.id}`])
  })
})

describe('removeBlock', () => {
  it('unlinks timed placements, removes untimed ones, and buries the block', () => {
    const { addBlock, addPlacement, removeBlock } = useBlocks.getState()
    const b = addBlock(JOB)
    const other = addBlock({ ...JOB, name: 'Gym', weekday: 1 })
    const untimed = addPlacement({ taskId: 'a', date: WED0, blockId: b.id })
    const timed = addPlacement({ taskId: 'b', date: WED0, blockId: b.id, start: 600, end: 660 })
    const elsewhere = addPlacement({ taskId: 'a', date: W0, blockId: other.id })

    removeBlock(b.id)

    expect(blocks().map((x) => x.id)).toEqual([other.id])
    const byId = new Map(placements().map((p) => [p.id, p]))
    expect(byId.has(untimed.id)).toBe(false)
    expect(byId.get(timed.id)).toMatchObject({ taskId: 'b', date: WED0, start: 600, end: 660 })
    expect('blockId' in byId.get(timed.id)!).toBe(false)
    expect(byId.get(elsewhere.id)!.blockId).toBe(other.id)
    expect(tombstones()).toEqual([`placement:${untimed.id}`, `block:${b.id}`])
  })
  it('removes one version only', () => {
    const { addBlock, updateBlockFrom, removeBlock } = useBlocks.getState()
    const b = addBlock(JOB)
    updateBlockFrom(b.id, W1, { start: 510 })
    removeBlock(b.id)
    expect(blocks()).toHaveLength(1)
    expect(blocks()[0].from).toBe(W1)
  })
})

describe('placements and Scheduled (TB-15, TB-17, D9)', () => {
  it('addPlacement writes scheduled = earliest placement day', () => {
    const { addPlacement } = useBlocks.getState()
    addPlacement({ taskId: 'a', date: WED1, start: 600, end: 660 })
    expect(scheduledOf('a')).toBe(WED1)
    addPlacement({ taskId: 'a', date: WED0, start: 600, end: 660 })
    expect(scheduledOf('a')).toBe(WED0)
    addPlacement({ taskId: 'a', date: WED2, start: 600, end: 660 })
    expect(scheduledOf('a')).toBe(WED0)
  })

  it('a placement stores a time only when both ends are given', () => {
    const p = useBlocks.getState().addPlacement({ taskId: 'a', date: WED0, blockId: 'x', start: 600 })
    expect(p).toEqual({ id: p.id, taskId: 'a', date: WED0, blockId: 'x', createdAt: p.createdAt, updatedAt: p.updatedAt })
    expect('start' in p).toBe(false)
  })

  it('removePlacement never clears scheduled', () => {
    const { addPlacement, removePlacement } = useBlocks.getState()
    const only = addPlacement({ taskId: 'a', date: WED0, start: 600, end: 660 })
    expect(scheduledOf('a')).toBe(WED0)
    removePlacement(only.id)
    expect(placements()).toEqual([])
    expect(scheduledOf('a')).toBe(WED0)
    expect(tombstones()).toEqual([`placement:${only.id}`])
  })

  it('removing the earliest placement moves scheduled to the next one', () => {
    const { addPlacement, removePlacement } = useBlocks.getState()
    const first = addPlacement({ taskId: 'a', date: WED0, start: 600, end: 660 })
    addPlacement({ taskId: 'a', date: WED1, start: 600, end: 660 })
    removePlacement(first.id)
    expect(scheduledOf('a')).toBe(WED1)
  })

  it('scheduled follows the placements, not the other way round (D9)', () => {
    // Scheduled Mon from the editor, then placed on Wed only: the placement is the source.
    useBlocks.getState().addPlacement({ taskId: 'c', date: WED1, start: 600, end: 660 })
    expect(scheduledOf('c')).toBe(WED1)
  })

  it('updatePlacement re-derives scheduled when the day changes', () => {
    const { addPlacement, updatePlacement } = useBlocks.getState()
    const p = addPlacement({ taskId: 'a', date: WED1, start: 600, end: 660 })
    updatePlacement(p.id, { date: WED0 })
    expect(scheduledOf('a')).toBe(WED0)
  })

  it('updatePlacement removes a placement left with neither block nor time', () => {
    const { addPlacement, updatePlacement } = useBlocks.getState()
    const p = addPlacement({ taskId: 'a', date: WED0, blockId: 'x', start: 600, end: 660 })
    updatePlacement(p.id, { start: undefined, end: undefined })
    expect(placements()[0]).toMatchObject({ blockId: 'x' })
    expect('start' in placements()[0]).toBe(false)
    updatePlacement(p.id, { blockId: undefined })
    expect(placements()).toEqual([])
    expect(tombstones()).toEqual([`placement:${p.id}`])
  })

  it('replaceAll takes both arrays as they are', () => {
    const b: Block = { ...useBlocks.getState().addBlock(JOB) }
    useBlocks.getState().replaceAll([b], [])
    expect(blocks()).toEqual([b])
    expect(placements()).toEqual([])
  })
})
