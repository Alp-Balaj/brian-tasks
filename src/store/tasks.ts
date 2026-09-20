import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { NewTask, Task, TaskPatch, TaskStatus } from '../domain/task'
import { DEFAULT_SPACE_ID } from '../domain/space'
import { useTombstones } from './tombstones'

interface TaskState {
  tasks: Task[]
  add: (input: NewTask) => Task
  /** Becoming `done` also unpins (Q25). */
  update: (id: string, patch: TaskPatch) => void
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
      const ts = now()
      const status = input.status ?? 'todo'
      const siblings = get().tasks.filter((t) => t.status === status)
      const task: Task = {
        id: nanoid(10),
        title: input.title.trim(),
        description: input.description ?? '',
        status,
        priority: input.priority ?? 'normal',
        tags: input.tags ?? [],
        due: input.due,
        scheduled: input.scheduled,
        order: input.order ?? Math.min(0, ...siblings.map((t) => t.order)) - 1,
        spaceId: input.spaceId ?? DEFAULT_SPACE_ID,
        archived: input.archived ?? false,
        pinned: status === 'done' ? false : (input.pinned ?? false),
        createdAt: ts,
        updatedAt: ts,
        completedAt: status === 'done' ? ts : undefined,
      }
      set({ tasks: [task, ...get().tasks] })
      return task
    },

    update: (id, patch) => {
      patchOne(id, (t) => {
        const next: Task = { ...t, ...patch, updatedAt: now() }
        if (patch.status && patch.status !== t.status) {
          next.completedAt = patch.status === 'done' ? now() : undefined
        }
        if (next.status === 'done') next.pinned = false
        return next
      })
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
