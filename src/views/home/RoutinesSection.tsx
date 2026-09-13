import { useEffect, useState } from 'react'
import { useRoutines } from '../../store/routines'
import { isScheduledOn } from '../../domain/routine'
import { toISODate } from '../../lib/dates'
import { RoutineRow } from '../../components/RoutineRow'
import { RoutineEditor } from '../../components/RoutineEditor'

/** Today's ISODate, re-evaluated every minute so an open Home rolls over at midnight (Q11). */
function useToday() {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = setInterval(() => {
      const now = toISODate(new Date())
      setToday((prev) => (prev === now ? prev : now))
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

/** "Routines · today": one row per non-archived Routine scheduled today (Q10, Q21, Q23). */
export function RoutinesSection() {
  const routines = useRoutines((s) => s.routines)
  const today = useToday()
  // `null` = creating; a string = editing that routine; undefined = closed.
  const [editing, setEditing] = useState<string | null | undefined>(undefined)

  const todayDate = new Date(`${today}T12:00:00`)
  const active = routines.filter((r) => !r.archived)
  const scheduled = active.filter((r) => isScheduledOn(r.schedule, todayDate))

  // Q10 says to hide the section entirely when there are no routines at all, but then the
  // first routine could never be created (Home is the only place that creates them). The
  // "+ routine" affordance therefore always renders; the header and rows only when
  // something is scheduled today. S5: confirm against the design artifact.
  const addButton = (
    <button
      onClick={() => setEditing(null)}
      className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
    >
      + routine
    </button>
  )

  return (
    <section className="flex flex-col gap-2">
      {scheduled.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-500">Routines · today</h2>
            {addButton}
          </div>
          <div className="flex flex-col gap-1.5">
            {scheduled.map((r) => (
              <RoutineRow key={r.id} routine={r} today={today} todayDate={todayDate} onOpen={() => setEditing(r.id)} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>{active.length > 0 ? 'No routines today.' : ''}</span>
          {addButton}
        </div>
      )}

      {editing !== undefined && <RoutineEditor routineId={editing} onClose={() => setEditing(undefined)} />}
    </section>
  )
}
