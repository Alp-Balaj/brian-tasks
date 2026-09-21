import { checklistProgress, describeEstimate, describeRepeat, STATUS_LABEL, type Task } from '../domain/task'
import { ALL_SPACES } from '../domain/space'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'
import { formatDay, toISODate } from '../lib/dates'
import { ChevronDownIcon } from './icons'
import { Chip } from './ui'

/** The one visual for a Space: a small dot in its colour. Shared by cards, rows and the switcher. */
export function SpaceDot({ colour, title, className = '' }: { colour: string; title?: string; className?: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: colour }}
    />
  )
}

/** The Space a task belongs to, but only when the switcher is on "All spaces" (Q30). */
function useTaskSpace(task: Task) {
  const all = useSpaceSelection((s) => s.selected === ALL_SPACES)
  return useSpaces((s) => (all ? s.spaces.find((x) => x.id === task.spaceId) : undefined))
}

/** Due date as a chip whose tone says how urgent it is (red = overdue, amber = today). Shared by cards and rows. */
export function DueChip({ due, done, today = toISODate(new Date()) }: { due: string; done?: boolean; today?: string }) {
  const tone = done ? 'neutral' : due < today ? 'danger' : due === today ? 'warn' : 'neutral'
  return <Chip tone={tone}>{formatDay(due, today)}</Chip>
}

/** Small "!" / "!!" mark for the two priorities that should stand out. */
export function PriorityMark({ priority }: { priority: Task['priority'] }) {
  if (priority === 'urgent') return <span className="text-xs font-bold text-danger">!!</span>
  if (priority === 'high') return <span className="text-xs font-bold text-warn">!</span>
  return null
}

/**
 * The quiet marks for Estimate, Checklist and Repeat (PD-1, PD-3, PD-4), in that order,
 * for any row or card's meta line. Renders nothing for a Task without them.
 */
export function TaskMarks({ task }: { task: Task }) {
  const progress = checklistProgress(task.checklist)
  return (
    <>
      {task.estimate !== undefined && (
        <span className="tabular-nums" title="Estimate">
          {describeEstimate(task.estimate)}
        </span>
      )}
      {progress.total > 0 && (
        <span className="tabular-nums" title="Checklist">
          {progress.done}/{progress.total}
        </span>
      )}
      {task.repeat && (
        <span title={describeRepeat(task.repeat)} aria-label={describeRepeat(task.repeat)}>
          ↻
        </span>
      )}
    </>
  )
}

/**
 * Compact task representation shared by board and calendar. Presentation only.
 * `onStatus` adds a status button (the tap alternative to dragging between columns).
 */
export function TaskCard({
  task,
  onClick,
  compact,
  onStatus,
}: {
  task: Task
  onClick?: () => void
  compact?: boolean
  onStatus?: () => void
}) {
  const space = useTaskSpace(task)
  const done = task.status === 'done'

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="flex cursor-pointer items-center gap-1 truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-xs hover:bg-surface-3"
      >
        <PriorityMark priority={task.priority} />
        <span className={`min-w-0 flex-1 truncate ${done ? 'text-fg-faint line-through' : ''}`}>{task.title}</span>
        {/* Compact cards have no room for the name; the dot alone still fits. */}
        {space && <SpaceDot colour={space.colour} title={space.name} />}
      </div>
    )
  }

  const hasMeta = task.due || task.tags.length > 0 || space || task.estimate || task.checklist?.length || task.repeat
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-surface px-3 py-2.5 shadow-sm shadow-black/5 ring-1 ring-line/60 transition-colors hover:ring-line-strong"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className={`flex items-baseline gap-1.5 text-[15px] leading-snug ${done ? 'text-fg-faint line-through' : ''}`}>
            <PriorityMark priority={task.priority} />
            <span className="min-w-0 line-clamp-3">{task.title}</span>
          </div>
          {hasMeta && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
              {space && (
                <span className="inline-flex items-center gap-1">
                  <SpaceDot colour={space.colour} />
                  {space.name}
                </span>
              )}
              {task.due && <DueChip due={task.due} done={done} />}
              <TaskMarks task={task} />
              {task.tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          )}
        </div>
        {onStatus && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStatus()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Status: ${STATUS_LABEL[task.status]}. Change`}
            className="-mt-1 -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-faint hover:bg-surface-2 hover:text-fg"
          >
            <ChevronDownIcon size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
