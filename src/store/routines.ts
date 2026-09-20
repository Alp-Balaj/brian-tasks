import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { ISODate } from '../domain/task'
import { checkInId, type CheckIn, type NewRoutine, type Routine, type RoutinePatch, type RoutineRecord } from '../domain/routine'
import { useTombstones } from './tombstones'

interface RoutineState {
  /** Routines with their `checkIns` attached — what the views read. */
  routines: Routine[]
  /** The Check-in records themselves; `routines[].checkIns` is derived from these. */
  checkIns: CheckIn[]
  add: (input: NewRoutine) => Routine
  update: (id: string, patch: RoutinePatch) => void
  /** Permanent delete. Only the Archive page offers it (Q28). */
  remove: (id: string) => void
  archive: (id: string) => void
  restore: (id: string) => void
  /** The store accepts any date; "today only" is enforced by the UI (Q22). */
  checkIn: (id: string, date: ISODate) => void
  uncheck: (id: string, date: ISODate) => void
  replaceAll: (routines: RoutineRecord[], checkIns: CheckIn[]) => void
}

const now = () => new Date().toISOString()

export const useRoutines = create<RoutineState>((set, get) => {
  const patchOne = (id: string, fn: (r: Routine) => Routine) =>
    set({ routines: get().routines.map((r) => (r.id === id ? fn(r) : r)) })
  const setCheckIns = (checkIns: CheckIn[]) => set({ checkIns, routines: attachCheckIns(get().routines, checkIns) })

  return {
    routines: [],
    checkIns: [],

    add: (input) => {
      const ts = now()
      const routine: Routine = {
        id: nanoid(10),
        title: input.title.trim(),
        schedule: input.schedule ?? { kind: 'daily' },
        note: input.note ?? '',
        archived: input.archived ?? false,
        checkIns: [],
        createdAt: ts,
        updatedAt: ts,
      }
      set({ routines: [...get().routines, routine] })
      return routine
    },

    update: (id, patch) => {
      patchOne(id, (r) => ({ ...r, ...patch, updatedAt: now() }))
    },

    remove: (id) => {
      const { bury } = useTombstones.getState()
      const { routines, checkIns } = get()
      if (!routines.some((r) => r.id === id)) return
      for (const c of checkIns) if (c.routineId === id) bury('checkin', checkInId(c.routineId, c.date))
      bury('routine', id)
      set({
        routines: routines.filter((r) => r.id !== id),
        checkIns: checkIns.filter((c) => c.routineId !== id),
      })
    },
    archive: (id) => patchOne(id, (r) => ({ ...r, archived: true, updatedAt: now() })),
    restore: (id) => patchOne(id, (r) => ({ ...r, archived: false, updatedAt: now() })),

    checkIn: (id, date) => {
      const checkIns = get().checkIns
      if (checkIns.some((c) => c.routineId === id && c.date === date)) return
      setCheckIns([...checkIns, { routineId: id, date, updatedAt: now() }])
    },
    uncheck: (id, date) => {
      const checkIns = get().checkIns
      if (!checkIns.some((c) => c.routineId === id && c.date === date)) return
      useTombstones.getState().bury('checkin', checkInId(id, date))
      setCheckIns(checkIns.filter((c) => !(c.routineId === id && c.date === date)))
    },

    replaceAll: (routines, checkIns) => set({ checkIns, routines: attachCheckIns(routines, checkIns) }),
  }
})

/**
 * Join Check-in records onto their Routines, keeping each `checkIns` sorted and
 * unique — the invariant `Routine.checkIns` promises. Routines whose days did not
 * change keep their identity, so views re-render only where something moved.
 */
export function attachCheckIns(routines: (RoutineRecord | Routine)[], checkIns: CheckIn[]): Routine[] {
  const byRoutine = new Map<string, ISODate[]>()
  for (const c of checkIns) {
    const days = byRoutine.get(c.routineId)
    if (days) days.push(c.date)
    else byRoutine.set(c.routineId, [c.date])
  }
  return routines.map((r) => {
    const days = [...new Set(byRoutine.get(r.id) ?? [])].sort()
    const current = (r as Routine).checkIns
    if (current && current.length === days.length && current.every((d, i) => d === days[i])) return r as Routine
    return { ...r, checkIns: days }
  })
}

/** The Routine rows as they are stored and synced (no derived `checkIns`). */
export const routineRecords = (routines: Routine[]): RoutineRecord[] =>
  routines.map(({ checkIns: _days, ...record }) => record)
