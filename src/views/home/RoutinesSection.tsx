import { useState } from 'react'
import { useRoutines } from '../../store/routines'
import { hasCheckIn, isScheduledOn } from '../../domain/routine'
import type { ISODate } from '../../domain/task'
import { RoutineRow } from '../../components/RoutineRow'
import { RoutineEditor } from '../../components/RoutineEditor'
import { RowGroup } from '../../components/TaskRow'
import { SectionLabel } from '../../components/ui'
import { PlusIcon } from '../../components/icons'

/** "Routines": one row per non-archived Routine scheduled today, with today's tally (Q10, Q21, Q23). */
export function RoutinesSection({ today }: { today: ISODate }) {
  const routines = useRoutines((s) => s.routines)
  // `null` = creating; a string = editing that routine; undefined = closed.
  const [editing, setEditing] = useState<string | null | undefined>(undefined)

  const todayDate = new Date(`${today}T12:00:00`)
  const active = routines.filter((r) => !r.archived)
  const scheduled = active.filter((r) => isScheduledOn(r.schedule, todayDate))
  const done = scheduled.filter((r) => hasCheckIn(r, today)).length

  // Q24 hides empty sections, but Q21 makes this section the only place a Routine can be
  // created — at zero Routines those can't both hold, or the first one could never exist.
  // Resolved at integration: the "+ routine" affordance always renders; the header and rows
  // only when something is scheduled today.
  const addButton = (
    <button
      onClick={() => setEditing(null)}
      className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
    >
      <PlusIcon size={14} />
      routine
    </button>
  )

  return (
    <section className="flex flex-col gap-1.5">
      {scheduled.length > 0 ? (
        <>
          <div className="flex items-center justify-between px-1">
            <SectionLabel className="flex items-baseline gap-2">
              Routines
              <span className={`font-normal ${done === scheduled.length ? 'text-success' : 'text-fg-faint'}`}>
                {done}/{scheduled.length}
              </span>
            </SectionLabel>
            {addButton}
          </div>
          <RowGroup>
            {scheduled.map((r) => (
              <RoutineRow key={r.id} routine={r} today={today} todayDate={todayDate} onOpen={() => setEditing(r.id)} />
            ))}
          </RowGroup>
        </>
      ) : (
        <div className="flex items-center justify-between px-1 text-xs text-fg-faint">
          <span>{active.length > 0 ? 'No routines today.' : ''}</span>
          {addButton}
        </div>
      )}

      {editing !== undefined && <RoutineEditor routineId={editing} onClose={() => setEditing(undefined)} />}
    </section>
  )
}
