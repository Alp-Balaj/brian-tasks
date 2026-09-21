import { useState } from 'react'
import { useTasks, type LaterChoice } from '../store/tasks'
import { Sheet } from './Sheet'
import { ChipButton, field } from './ui'
import { format } from 'date-fns'
import { shiftISODate, toISODate } from '../lib/dates'

/**
 * PD-10: where a Task goes when it is not for today — tomorrow, next week, a chosen
 * day, or (when it is on Today only because it is Scheduled) nowhere. Moves `field`
 * through the store's `later`, which leaves Placements alone (TB-17).
 */
export function LaterMenu({
  taskId,
  field: which,
  onClose,
}: {
  taskId: string
  /** The date that put the Task on Today: Due if it was due or overdue, else Scheduled. */
  field: 'due' | 'scheduled'
  onClose: () => void
}) {
  const task = useTasks((s) => s.tasks.find((t) => t.id === taskId))
  const later = useTasks((s) => s.later)
  const [picking, setPicking] = useState(false)
  if (!task) return null
  const today = toISODate(new Date())

  const choose = (choice: LaterChoice) => {
    later(task.id, choice, which)
    onClose()
  }

  const dayName = (iso: string) => format(new Date(`${iso}T12:00:00`), 'EEE d MMM')

  const option = (label: string, hint: string, choice: LaterChoice) => (
    <li>
      <button
        onClick={() => choose(choice)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-[15px] hover:bg-surface-2"
      >
        {label}
        <span className="text-xs text-fg-faint">{hint}</span>
      </button>
    </li>
  )

  return (
    <Sheet onClose={onClose} size="sm" title={<span className="line-clamp-1 font-medium">{task.title}</span>}>
      <ul aria-label="Later" className="flex flex-col gap-1 pb-2">
        {option('Tomorrow', dayName(shiftISODate(today, 1)), 'tomorrow')}
        {option('Next week', dayName(shiftISODate(today, 7)), 'next-week')}
        <li>
          {picking ? (
            <input
              autoFocus
              type="date"
              min={today}
              aria-label="Pick a day"
              onChange={(e) => e.target.value && choose(e.target.value)}
              className={`${field} min-h-12`}
            />
          ) : (
            <button onClick={() => setPicking(true)} className="flex min-h-12 w-full items-center rounded-xl px-4 text-left text-[15px] hover:bg-surface-2">
              Pick a day…
            </button>
          )}
        </li>
        {which === 'scheduled' && (
          <li>
            <button
              onClick={() => choose('unschedule')}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-[15px] text-fg-muted hover:bg-surface-2"
            >
              Unschedule
              <span className="text-xs text-fg-faint">no day</span>
            </button>
          </li>
        )}
      </ul>
      <p className="px-4 pb-3 text-xs text-fg-faint">
        Moves the {which === 'due' ? 'due date' : 'scheduled day'}.{' '}
        <ChipButton onClick={onClose} className="min-h-7 px-2 text-xs">
          Keep today
        </ChipButton>
      </p>
    </Sheet>
  )
}
