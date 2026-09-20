import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '../domain/task'
import { useTasks } from '../store/tasks'
import { Sheet } from './Sheet'
import { CheckIcon } from './icons'

/**
 * Bottom-sheet picker for a task's Status — the tap alternative to dragging a card
 * between Board columns. Moving puts the task at the top of its new column.
 */
export function StatusMenu({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTasks((s) => s.tasks.find((t) => t.id === taskId))
  const move = useTasks((s) => s.move)
  if (!task) return null

  const choose = (status: TaskStatus) => {
    if (status !== task.status) move(task.id, status, 0)
    onClose()
  }

  return (
    <Sheet onClose={onClose} size="sm" title={<span className="line-clamp-1 font-medium">{task.title}</span>}>
      <ul role="listbox" aria-label="Status" className="flex flex-col gap-1 pb-2">
        {TASK_STATUSES.map((s) => {
          const active = s === task.status
          return (
            <li key={s}>
              <button
                role="option"
                aria-selected={active}
                onClick={() => choose(s)}
                className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-[15px] ${
                  active ? 'bg-surface-2 font-medium' : 'hover:bg-surface-2'
                }`}
              >
                {STATUS_LABEL[s]}
                {active && <CheckIcon size={18} className="text-accent" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
