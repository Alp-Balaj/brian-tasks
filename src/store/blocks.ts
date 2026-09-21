import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  appliesTo,
  buildBlock,
  isTimed,
  movePlacements,
  nextWeek,
  removePlacementsOf,
  repointPlacements,
  scheduledFromPlacements,
  splitAt,
  touchedTasks,
  unlinkPlacements,
  type Block,
  type BlockPatch,
  type NewBlock,
  type NewPlacement,
  type Placement,
  type PlacementChange,
  type PlacementPatch,
  type WeekKey,
} from '../domain/block'
import { useTasks } from './tasks'
import { useTombstones } from './tombstones'

interface BlockState {
  /** Every version of every block, past weeks included (TB-1). Views filter with `blocksInWeek` / `blocksOn`. */
  blocks: Block[]
  placements: Placement[]

  addBlock: (input: NewBlock) => Block
  /**
   * TB-5: the change applies from `week` on; earlier weeks keep what they had. If
   * the version already starts in `week` (or later) it is patched in place. Otherwise
   * it is split at `week` (D8): the past version keeps the id, the patch lands on the
   * future one, and placements with `date >= week` are re-pointed to it. Moving the
   * block to another weekday moves its placements with it. Returns the id of the
   * version the change landed on (fresh after a split), so an open sheet can follow
   * it; undefined when nothing applied.
   */
  updateBlockFrom: (id: string, week: WeekKey, patch: BlockPatch) => string | undefined
  /**
   * Carry to next week (TB-4). Off: `until = nextWeek(week)`, so `week` is the last
   * week, and placements in the block from then on are unlinked. On: `until` is
   * cleared. Splits at `week` like `updateBlockFrom` when the version started earlier,
   * and returns the id of the version it landed on the same way.
   */
  setCarry: (id: string, week: WeekKey, carry: boolean) => string | undefined
  /**
   * "Remove from this week on" (§2): the version stops at `week` and its placements
   * from `week` on are removed. A version that starts in `week` or later is deleted
   * outright, since nothing of it would be left.
   */
  endBlock: (id: string, week: WeekKey) => void
  /** Deletes this one version only. Placements in it: untimed ones are removed, timed ones lose the link. */
  removeBlock: (id: string) => void

  /** Then the Task's Scheduled follows its earliest placement (TB-15). */
  addPlacement: (input: NewPlacement) => Placement
  /** A patch that leaves neither a block nor a time removes the placement. */
  updatePlacement: (id: string, patch: PlacementPatch) => void
  /** Scheduled is re-derived from what is left, but never cleared (TB-17). */
  removePlacement: (id: string) => void

  replaceAll: (blocks: Block[], placements: Placement[]) => void
}

const now = () => new Date().toISOString()

export const useBlocks = create<BlockState>((set, get) => {
  /**
   * D9: `scheduled` is a projection of the Task's placements — the earliest day.
   * Never cleared here: a Task with no placements left keeps the day it had.
   */
  const syncScheduled = (taskId: string) => {
    const tasks = useTasks.getState()
    const task = tasks.tasks.find((t) => t.id === taskId)
    if (!task) return
    const next = scheduledFromPlacements(task, get().placements)
    if (next !== undefined && next !== task.scheduled) tasks.update(taskId, { scheduled: next })
  }

  const setPlacements = (placements: Placement[], touched: Iterable<string>) => {
    set({ placements })
    for (const taskId of new Set(touched)) syncScheduled(taskId)
  }

  /** Keep a revision (domain/block.ts): the removed ones are buried, the touched Tasks re-derived. */
  const applyChange = (change: PlacementChange) => {
    const { bury } = useTombstones.getState()
    for (const p of change.removed) bury('placement', p.id)
    setPlacements(change.placements, touchedTasks(change))
  }

  /**
   * The version of `id` that a change from `week` on lands in (TB-5): the block
   * itself when its rule starts in `week` or later, else the future half of a split
   * at `week`, with placements from `week` on re-pointed to it (D8). Undefined when
   * there is no such block, or its rule had already ended before `week`.
   */
  const versionFrom = (id: string, week: WeekKey): Block | undefined => {
    const block = get().blocks.find((b) => b.id === id)
    if (!block) return undefined
    if (block.from >= week) return block
    if (!appliesTo(block, week)) return undefined
    const { past, future } = splitAt(block, week, now(), nanoid(10))
    set({
      blocks: [...get().blocks.map((b) => (b.id === id ? past : b)), future],
      placements: repointPlacements(get().placements, id, future.id, week, future.updatedAt).placements,
    })
    return future
  }

  const patchBlock = (id: string, fn: (b: Block) => Block) =>
    set({ blocks: get().blocks.map((b) => (b.id === id ? fn(b) : b)) })

  return {
    blocks: [],
    placements: [],

    addBlock: (input) => {
      const block = buildBlock(input, nanoid(10), now())
      set({ blocks: [...get().blocks, block] })
      return block
    },

    updateBlockFrom: (id, week, patch) => {
      const version = versionFrom(id, week)
      if (!version) return undefined
      const name = patch.name === undefined ? version.name : patch.name.trim()
      patchBlock(version.id, (b) => ({ ...b, ...patch, name, updatedAt: now() }))
      if (patch.weekday !== undefined && patch.weekday !== version.weekday) {
        applyChange(movePlacements(get().placements, version.id, patch.weekday, now()))
      }
      return version.id
    },

    setCarry: (id, week, carry) => {
      const version = versionFrom(id, week)
      if (!version) return undefined
      const until = carry ? undefined : nextWeek(week)
      if (version.until === until) return version.id
      patchBlock(version.id, ({ until: _was, ...rest }) => ({ ...rest, ...(until === undefined ? {} : { until }), updatedAt: now() }))
      if (until !== undefined) applyChange(unlinkPlacements(get().placements, version.id, now(), until))
      return version.id
    },

    endBlock: (id, week) => {
      const block = get().blocks.find((b) => b.id === id)
      if (!block) return
      applyChange(removePlacementsOf(get().placements, id, week))
      if (block.from >= week) get().removeBlock(id)
      else if (appliesTo(block, week)) patchBlock(id, (b) => ({ ...b, until: week, updatedAt: now() }))
    },

    removeBlock: (id) => {
      if (!get().blocks.some((b) => b.id === id)) return
      applyChange(unlinkPlacements(get().placements, id, now()))
      useTombstones.getState().bury('block', id)
      set({ blocks: get().blocks.filter((b) => b.id !== id) })
    },

    addPlacement: (input) => {
      const ts = now()
      const placement = withinRule({
        id: nanoid(10),
        taskId: input.taskId,
        date: input.date,
        blockId: input.blockId,
        start: input.start,
        end: input.end,
        createdAt: ts,
        updatedAt: ts,
      })
      setPlacements([...get().placements, placement], [placement.taskId])
      return placement
    },

    updatePlacement: (id, patch) => {
      const current = get().placements.find((p) => p.id === id)
      if (!current) return
      const next = withinRule({ ...current, ...patch, updatedAt: now() })
      if (next.blockId === undefined && !isTimed(next)) {
        get().removePlacement(id)
        return
      }
      setPlacements(
        get().placements.map((p) => (p.id === id ? next : p)),
        next.date === current.date ? [] : [current.taskId],
      )
    },

    removePlacement: (id) => {
      const placement = get().placements.find((p) => p.id === id)
      if (!placement) return
      useTombstones.getState().bury('placement', id)
      setPlacements(
        get().placements.filter((p) => p.id !== id),
        [placement.taskId],
      )
    },

    replaceAll: (blocks, placements) => set({ blocks, placements }),
  }
})

/**
 * A Placement as the model promises it: a time is both ends or neither, and no
 * key is present with an undefined value (the record is stored and synced as JSON).
 */
function withinRule(p: Placement): Placement {
  const { blockId, start, end, ...rest } = p
  const timed = start !== undefined && end !== undefined
  return { ...rest, ...(blockId === undefined ? {} : { blockId }), ...(timed ? { start, end } : {}) }
}
