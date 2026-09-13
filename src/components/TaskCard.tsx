import type { Task } from '../domain/task'

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-neutral-300',
  low: 'bg-neutral-200',
}

/** Compact task representation shared by board and calendar. Presentation only. */
export function TaskCard({ task, onClick, compact }: { task: Task; onClick?: () => void; compact?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-md border border-neutral-200 bg-white shadow-sm hover:border-neutral-400 ${
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <span className={`min-w-0 flex-1 ${compact ? 'truncate' : ''} ${task.status === 'done' ? 'text-neutral-400 line-through' : ''}`}>
          {task.title}
        </span>
      </div>
      {!compact && (task.due || task.tags.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-1 pl-4 text-xs text-neutral-500">
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
