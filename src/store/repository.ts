import type { Task } from '../domain/task'

/**
 * Persistence boundary. The app only ever talks to this interface, so swapping
 * localStorage for a real backend (REST, Supabase, SQLite via Tauri, ...) is a
 * matter of writing another adapter — no view code changes.
 */
export interface TaskRepository {
  loadAll(): Promise<Task[]>
  saveAll(tasks: Task[]): Promise<void>
}

const STORAGE_KEY = 'brian-tasks:v1'

export const localStorageRepository: TaskRepository = {
  async loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as Task[]) : []
    } catch {
      return []
    }
  },
  async saveAll(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Storage quota / private mode — the in-memory state still works for the session.
    }
  },
}
