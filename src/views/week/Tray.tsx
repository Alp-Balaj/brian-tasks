import { describeEstimate, type ISODate, type Task } from '../../domain/task'
import { useSpaces } from '../../store/spaces'
import { PriorityMark, SpaceDot } from '../../components/TaskCard'

interface Props {
  date: ISODate
  /** `unplacedOn(tasks, placements, date)`, by priority. */
  tasks: readonly Task[]
  /** Tap a chip to put the task on the day (TB-18): the placement form, or a block's picker. */
  onPlace: (task: Task) => void
  className?: string
}

/**
 * The day's unplaced tray (TB-18): Tasks Scheduled that day with no placement on it,
 * as chips with the Space dot. Renders nothing when the day has none, so an empty
 * day is just its ruler.
 */
export function Tray({ date, tasks, onPlace, className = '' }: Props) {
  const spaces = useSpaces((s) => s.spaces)
  if (tasks.length === 0) return null
  return (
    <ul aria-label={`Unplaced on ${date}`} className={`flex flex-wrap gap-1 ${className}`}>
      {tasks.map((t) => {
        const space = spaces.find((s) => s.id === t.spaceId)
        return (
          <li key={t.id} className="min-w-0 max-w-full">
            <button
              type="button"
              onClick={() => onPlace(t)}
              title={`${t.title} — place on this day`}
              className="flex min-h-7 max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface px-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <SpaceDot colour={space?.colour ?? '#d4d4d4'} title={space?.name} />
              <PriorityMark priority={t.priority} />
              <span className="truncate">{t.title}</span>
              {/* PD-1: the length a drop would take (PD-2). */}
              {t.estimate !== undefined && <span className="shrink-0 tabular-nums text-fg-faint">{describeEstimate(t.estimate)}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
