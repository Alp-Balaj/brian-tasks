import type { Task } from '../../domain/task'
import { useSpaces } from '../../store/spaces'
import type { TodayReason } from './homeSections'

const CHIP: Record<TodayReason, string> = {
  overdue: 'bg-red-50 text-red-700',
  'due today': 'bg-neutral-100 text-neutral-700',
  scheduled: 'bg-neutral-100 text-neutral-500',
}

/**
 * One task on Home. Always shows the Space colour dot (Q30) because Home spans every Space.
 * No checkbox: the editor is one tap away.
 */
export function HomeTaskRow({
  task,
  reason,
  onOpen,
  onUnpin,
}: {
  task: Task
  reason?: TodayReason
  onOpen: () => void
  /** Present only in the Pinned section. */
  onUnpin?: () => void
}) {
  const colour = useSpaces((s) => s.spaces.find((sp) => sp.id === task.spaceId)?.colour)
  const done = task.status === 'done'

  return (
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: colour ?? '#d4d4d4' }}
        aria-hidden
      />
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-neutral-400 line-through' : ''}`}>
          {task.title}
        </span>
        {reason && <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${CHIP[reason]}`}>{reason}</span>}
      </button>
      {onUnpin && (
        <button
          onClick={onUnpin}
          title="Unpin from Home"
          aria-label="Unpin from Home"
          className="shrink-0 rounded px-1.5 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          ✕
        </button>
      )}
    </li>
  )
}
