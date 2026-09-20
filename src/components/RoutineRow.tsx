import { useRoutines } from '../store/routines'
import { currentStreak, hasCheckIn, type Routine } from '../domain/routine'
import type { ISODate } from '../domain/task'
import { CircleCheck } from './ui'

interface Props {
  routine: Routine
  /** Today as ISODate and as a Date — both derived from the same instant by the caller. */
  today: ISODate
  todayDate: Date
  /** "06:00": the start of the earliest block today this Routine is linked to (TB-20). */
  at?: string
  onOpen: () => void
}

/** One Routine on Home: today's Check-in control, title, note, streak, and the block's hour when linked. */
export function RoutineRow({ routine, today, todayDate, at, onOpen }: Props) {
  const checkIn = useRoutines((s) => s.checkIn)
  const uncheck = useRoutines((s) => s.uncheck)
  const done = hasCheckIn(routine, today)
  const streak = currentStreak(routine, todayDate)

  return (
    <li className="flex min-h-14 items-center gap-1 pr-3 pl-1">
      {/* Only today can be checked or unchecked here — there is no back-fill UI (Q22). */}
      <CircleCheck
        checked={done}
        onChange={(next) => (next ? checkIn(routine.id, today) : uncheck(routine.id, today))}
        label={`${routine.title} done today`}
        tone="success"
        size="lg"
      />
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col justify-center py-2 text-left">
        <span className={`truncate text-[15px] leading-snug ${done ? 'text-fg-faint' : 'text-fg'}`}>{routine.title}</span>
        {(at || routine.note) && (
          <span className="flex min-w-0 gap-x-2 text-xs text-fg-muted">
            {at && <span className="shrink-0 tabular-nums">at {at}</span>}
            {routine.note && <span className="truncate">{routine.note}</span>}
          </span>
        )}
      </button>
      {streak > 0 && (
        <span
          title={`${streak}-day streak`}
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
            done ? 'bg-success-soft text-success' : 'bg-surface-2 text-fg-muted'
          }`}
        >
          {streak}d
        </span>
      )}
    </li>
  )
}
