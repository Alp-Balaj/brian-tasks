import type { Task } from '../domain/task'
import { ALL_SPACES } from '../domain/space'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-neutral-300',
  low: 'bg-neutral-200',
}

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

/** Compact task representation shared by board and calendar. Presentation only. */
export function TaskCard({ task, onClick, compact }: { task: Task; onClick?: () => void; compact?: boolean }) {
  const space = useTaskSpace(task)
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-md border border-neutral-200 bg-white shadow-sm hover:border-neutral-400 ${
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <span
          className={`min-w-0 flex-1 ${compact ? 'truncate' : ''} ${task.status === 'done' ? 'text-neutral-400 line-through' : ''}`}
        >
          {task.title}
        </span>
        {/* Compact cards have no room for the name; the dot alone still fits. */}
        {compact && space && <SpaceDot colour={space.colour} title={space.name} className="mt-1" />}
      </div>
      {!compact && (task.due || task.tags.length > 0 || space) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-4 text-xs text-neutral-500">
          {space && (
            <span className="inline-flex items-center gap-1">
              <SpaceDot colour={space.colour} />
              {space.name}
            </span>
          )}
          {task.due && <span>due {task.due}</span>}
          {task.tags.map((t) => (
            <span key={t} className="rounded bg-neutral-100 px-1">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
