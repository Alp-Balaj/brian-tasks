import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { NewTask, Task, TaskPatch, TaskStatus } from '../domain/task'
import { localStorageRepository, type TaskRepository } from './repository'

interface TaskState {
  tasks: Task[]
  hydrated: boolean
  hydrate: () => Promise<void>
  add: (input: NewTask) => Task
  update: (id: string, patch: TaskPatch) => void
  remove: (id: string) => void
  /** Move a task to a status column and position it at `index` among its new siblings. */
  move: (id: string, status: TaskStatus, index: number) => void
  replaceAll: (tasks: Task[]) => void
}

const repo: TaskRepository = localStorageRepository

const now = () => new Date().toISOString()

export const useTasks = create<TaskState>((set, get) => {
  // Persist after every mutation. Cheap enough at this scale; debounce if it ever isn't.
  const commit = (tasks: Task[]) => {
    set({ tasks })
    void repo.saveAll(tasks)
  }

  return {
    tasks: [],
    hydrated: false,

    hydrate: async () => {
      let tasks = await repo.loadAll()
      if (tasks.length === 0) {
        tasks = await loadSeed()
        if (tasks.length > 0) await repo.saveAll(tasks)
      }
      set({ tasks, hydrated: true })
    },

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
        createdAt: ts,
        updatedAt: ts,
        completedAt: status === 'done' ? ts : undefined,
      }
      commit([task, ...get().tasks])
      return task
    },

    update: (id, patch) => {
      commit(
        get().tasks.map((t) => {
          if (t.id !== id) return t
          const next: Task = { ...t, ...patch, updatedAt: now() }
          if (patch.status && patch.status !== t.status) {
            next.completedAt = patch.status === 'done' ? now() : undefined
          }
          return next
        }),
      )
    },

    remove: (id) => {
      commit(get().tasks.filter((t) => t.id !== id))
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
      commit(
        tasks.map((t) => {
          const order = reordered.get(t.id)
          if (order === undefined) return t
          if (t.id === id) {
            return {
              ...t,
              status,
              order,
              updatedAt: ts,
              completedAt: status === 'done' ? (t.completedAt ?? ts) : undefined,
            }
          }
          return t.order === order ? t : { ...t, order }
        }),
      )
    },

    replaceAll: (tasks) => commit(tasks),
  }
})

/** First-run seed: `public/seed.json`, produced by `scripts/import-obsidian.mjs`. Optional. */
async function loadSeed(): Promise<Task[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}seed.json`)
    if (!res.ok) return []
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as Task[]) : []
  } catch {
    return []
  }
}

// ---- Selectors (pure, so they can be unit-tested and reused across views) ----

export const byColumn = (tasks: Task[], status: TaskStatus) =>
  tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order)

export const onDate = (tasks: Task[], date: string) =>
  tasks.filter((t) => t.due === date || t.scheduled === date)
