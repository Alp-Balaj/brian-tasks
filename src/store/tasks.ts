import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  applyPatch,
  buildTask,
  completeRepeating,
  finishesRepeating,
  type ISODate,
  type NewTask,
  type Task,
  type TaskPatch,
  type TaskStatus,
} from '../domain/task'
import { useTombstones } from './tombstones'
import { shiftISODate, toISODate } from '../lib/dates'

/** Where Later sends a Task (PD-10). */
export type LaterChoice = 'tomorrow' | 'next-week' | 'unschedule' | ISODate

interface TaskState {
  tasks: Task[]
  add: (input: NewTask) => Task
  /** Becoming `done` also unpins (Q25); a Task with a Repeat spawns its next occurrence (PD-5). */
  update: (id: string, patch: TaskPatch) => void
  /**
   * PD-10: move the date that puts the Task on Today. `field` is Due when the Task is
   * due today or overdue, else Scheduled; `unschedule` clears Scheduled only.
   */
  later: (id: string, choice: LaterChoice, field: 'due' | 'scheduled') => void
  /** Permanent delete. Only the Archive page offers it (Q28). */
  remove: (id: string) => void
  /** Move a task to a status column and position it at `index` among its new siblings. */
  move: (id: string, status: TaskStatus, index: number) => void
  archive: (id: string) => void
  restore: (id: string) => void
  togglePin: (id: string) => void
  replaceAll: (tasks: Task[]) => void
}

const now = () => new Date().toISOString()

// Persistence is not wired here: store/persist.ts subscribes to this store and
// saves the combined snapshot after every change.
export const useTasks = create<TaskState>((set, get) => {
  const patchOne = (id: string, fn: (t: Task) => Task) =>
    set({ tasks: get().tasks.map((t) => (t.id === id ? fn(t) : t)) })

  return {
    tasks: [],

    add: (input) => {
      const task = buildTask(input, nanoid(10), get().tasks, now())
      set({ tasks: [task, ...get().tasks] })
      return task
    },

    update: (id, patch) => {
      const ts = now()
      const task = get().tasks.find((t) => t.id === id)
      if (task && finishesRepeating(task, patch)) {
        // Whatever else the patch carries lands first; the finish itself is the domain's.
        const { status: _done, ...rest } = patch
        const before = { ...applyPatch(task, rest, ts), repeat: task.repeat }
        const { done, next } = completeRepeating(before, get().tasks, nanoid(10), ts, toISODate(new Date()))
        set({ tasks: [next, ...get().tasks.map((t) => (t.id === id ? done : t))] })
        return
      }
      patchOne(id, (t) => applyPatch(t, patch, ts))
    },

    later: (id, choice, field) => {
      const today = toISODate(new Date())
      if (choice === 'unschedule') {
        get().update(id, { scheduled: undefined })
        return
      }
      const date = choice === 'tomorrow' ? shiftISODate(today, 1) : choice === 'next-week' ? shiftISODate(today, 7) : choice
      get().update(id, { [field]: date })
    },

    remove: (id) => {
      if (!get().tasks.some((t) => t.id === id)) return
      useTombstones.getState().bury('task', id)
      set({ tasks: get().tasks.filter((t) => t.id !== id) })
    },

    move: (id, status, index) => {
      const tasks = get().tasks
      const moving = tasks.find((t) => t.id === id)
      if (!moving) return
      // PD-5: dragging a repeating Task into Done finishes it and spawns the next one at the top of To do.
      if (finishesRepeating(moving, { status })) {
        get().update(id, { status })
        return
      }
      const column = tasks
        .filter((t) => t.status === status && t.id !== id)
        .sort((a, b) => a.order - b.order)
      column.splice(Math.max(0, Math.min(index, column.length)), 0, { ...moving, status })
      const reordered = new Map(column.map((t, i) => [t.id, i]))
      const ts = now()
      set({
        tasks: tasks.map((t) => {
          const order = reordered.get(t.id)
          if (order === undefined) return t
          if (t.id === id) {
            const done = status === 'done'
            return {
              ...t,
              status,
              order,
              updatedAt: ts,
              completedAt: done ? (t.completedAt ?? ts) : undefined,
              pinned: done ? false : t.pinned,
            }
          }
          // Siblings that shift need a fresh `updatedAt` too, or other Devices never learn the new order.
          return t.order === order ? t : { ...t, order, updatedAt: ts }
        }),
      })
    },

    archive: (id) => patchOne(id, (t) => ({ ...t, archived: true, updatedAt: now() })),
    restore: (id) => patchOne(id, (t) => ({ ...t, archived: false, updatedAt: now() })),
    togglePin: (id) => patchOne(id, (t) => ({ ...t, pinned: !t.pinned, updatedAt: now() })),

    replaceAll: (tasks) => set({ tasks }),
  }
})

// ---- Selectors (pure, so they can be unit-tested and reused across views) ----

export const byColumn = (tasks: Task[], status: TaskStatus) =>
  tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order)

export const onDate = (tasks: Task[], date: string) =>
  tasks.filter((t) => t.due === date || t.scheduled === date)
