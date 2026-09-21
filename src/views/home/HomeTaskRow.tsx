import type { ReactNode } from 'react'
import type { Task } from '../../domain/task'
import { useSpaces } from '../../store/spaces'
import type { TodayReason } from '../../domain/home'
import { TaskRow } from '../../components/TaskRow'
import { DueChip, SpaceDot, TaskMarks } from '../../components/TaskCard'
import { Chip } from '../../components/ui'

/**
 * One task on Home. Always shows the Space (Q30) because Home spans every Space, plus
 * the due date as a chip, or "Scheduled" when that is why it is here, and — when the
 * task is placed today — its hour or the block it sits in (TB-20).
 */
export function HomeTaskRow({
  task,
  reason,
  hour,
  onOpen,
  onToggleDone,
  trailing,
}: {
  task: Task
  reason?: TodayReason
  /** "16:00–17:00" from today's timed placement, or the block name when only linked. */
  hour?: string
  onOpen: () => void
  onToggleDone: (done: boolean) => void
  trailing?: ReactNode
}) {
  const space = useSpaces((s) => s.spaces.find((sp) => sp.id === task.spaceId))
  const done = task.status === 'done'

  return (
    <TaskRow
      task={task}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
      trailing={trailing}
      meta={
        <>
          <span className="inline-flex items-center gap-1">
            <SpaceDot colour={space?.colour ?? '#d4d4d4'} />
            {space?.name ?? 'Unknown space'}
          </span>
          {task.due ? <DueChip due={task.due} done={done} /> : reason === 'scheduled' && <Chip tone="accent">Scheduled</Chip>}
          {hour && <span className="tabular-nums">{hour}</span>}
          <TaskMarks task={task} />
        </>
      }
    />
  )
}
