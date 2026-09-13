import { useRoutines } from '../store/routines'
import { currentStreak, hasCheckIn, type Routine } from '../domain/routine'
import type { ISODate } from '../domain/task'

interface Props {
  routine: Routine
  /** Today as ISODate and as a Date — both derived from the same instant by the caller. */
  today: ISODate
  todayDate: Date
  onOpen: () => void
}

/** One Routine on Home: today's Check-in checkbox, title, note, streak badge. */
export function RoutineRow({ routine, today, todayDate, onOpen }: Props) {
  const checkIn = useRoutines((s) => s.checkIn)
  const uncheck = useRoutines((s) => s.uncheck)
  const done = hasCheckIn(routine, today)
  const streak = currentStreak(routine, todayDate)

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
      {/* Only today can be checked or unchecked here — there is no back-fill UI (Q22). */}
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => (e.target.checked ? checkIn(routine.id, today) : uncheck(routine.id, today))}
        aria-label={`${routine.title} done today`}
        className="h-4 w-4 shrink-0"
      />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-sm ${done ? 'text-neutral-400' : ''}`}>{routine.title}</div>
        {routine.note && <div className="truncate text-xs text-neutral-500">{routine.note}</div>}
      </button>
      {streak > 0 && (
        <span
          title={`${streak}-day streak`}
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums ${
            done ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          ▲ {streak}
        </span>
      )}
    </div>
  )
}
