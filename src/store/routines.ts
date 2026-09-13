import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { ISODate } from '../domain/task'
import type { NewRoutine, Routine, RoutinePatch } from '../domain/routine'

interface RoutineState {
  routines: Routine[]
  add: (input: NewRoutine) => Routine
  update: (id: string, patch: RoutinePatch) => void
  /** Permanent delete. Only the Archive page offers it (Q28). */
  remove: (id: string) => void
  archive: (id: string) => void
  restore: (id: string) => void
  /** The store accepts any date; "today only" is enforced by the UI (Q22). */
  checkIn: (id: string, date: ISODate) => void
  uncheck: (id: string, date: ISODate) => void
  replaceAll: (routines: Routine[]) => void
}

const now = () => new Date().toISOString()

export const useRoutines = create<RoutineState>((set, get) => {
  const patchOne = (id: string, fn: (r: Routine) => Routine) =>
    set({ routines: get().routines.map((r) => (r.id === id ? fn(r) : r)) })

  return {
    routines: [],

    add: (input) => {
      const ts = now()
      const routine: Routine = {
        id: nanoid(10),
        title: input.title.trim(),
        schedule: input.schedule ?? { kind: 'daily' },
        note: input.note ?? '',
        archived: input.archived ?? false,
        checkIns: normaliseCheckIns(input.checkIns ?? []),
        createdAt: ts,
        updatedAt: ts,
      }
      set({ routines: [...get().routines, routine] })
      return routine
    },

    update: (id, patch) => {
      patchOne(id, (r) => ({
        ...r,
        ...patch,
        checkIns: patch.checkIns ? normaliseCheckIns(patch.checkIns) : r.checkIns,
        updatedAt: now(),
      }))
    },

    remove: (id) => set({ routines: get().routines.filter((r) => r.id !== id) }),
    archive: (id) => patchOne(id, (r) => ({ ...r, archived: true, updatedAt: now() })),
    restore: (id) => patchOne(id, (r) => ({ ...r, archived: false, updatedAt: now() })),

    checkIn: (id, date) =>
      patchOne(id, (r) =>
        r.checkIns.includes(date) ? r : { ...r, checkIns: normaliseCheckIns([...r.checkIns, date]), updatedAt: now() },
      ),
    uncheck: (id, date) =>
      patchOne(id, (r) =>
        r.checkIns.includes(date) ? { ...r, checkIns: r.checkIns.filter((d) => d !== date), updatedAt: now() } : r,
      ),

    replaceAll: (routines) => set({ routines }),
  }
})

/** Sorted ascending, unique — the invariant `Routine.checkIns` promises. */
const normaliseCheckIns = (dates: ISODate[]) => [...new Set(dates)].sort()
