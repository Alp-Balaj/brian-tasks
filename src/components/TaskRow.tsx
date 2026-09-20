import type { ReactNode } from 'react'
import type { Task } from '../domain/task'
import { CircleCheck, type Tone } from './ui'

/** Priority colours the empty check ring; normal and low stay quiet. */
const PRIORITY_TONE: Record<Task['priority'], Tone> = {
  urgent: 'danger',
  high: 'warn',
  normal: 'neutral',
  low: 'neutral',
}

/**
 * One task in a list (Home, List). Round check on the left, title, one line of
 * metadata, optional trailing action. Tapping the body opens the editor.
 */
export function TaskRow({
  task,
  onOpen,
  onToggleDone,
  meta,
  trailing,
}: {
  task: Task
  onOpen: () => void
  onToggleDone: (done: boolean) => void
  /** Secondary line: space, due chip, tags… Rendered only when given. */
  meta?: ReactNode
  trailing?: ReactNode
}) {
  const done = task.status === 'done'
  return (
    <li className="flex min-h-14 items-center gap-1 pr-2 pl-1 hover:bg-surface-2/60">
      <CircleCheck
        checked={done}
        onChange={onToggleDone}
        label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        tone={done ? 'neutral' : PRIORITY_TONE[task.priority]}
      />
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 text-left">
        <span className={`line-clamp-2 text-[15px] leading-snug ${done ? 'text-fg-faint line-through' : 'text-fg'}`}>
          {task.title}
        </span>
        {meta && <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">{meta}</span>}
      </button>
      {trailing}
    </li>
  )
}

/** Container for TaskRows: one grouped surface per section (iOS grouped-inset style). */
export function RowGroup({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</ul>
}
