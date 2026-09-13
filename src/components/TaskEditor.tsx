import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { Sheet } from './Sheet'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isTaskPriority,
  isTaskStatus,
} from '../domain/task'

interface Props {
  taskId: string
  onClose: () => void
}

const field = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900'

/** Full edit form for one task. Every change is saved immediately (no Save button). */
export function TaskEditor({ taskId, onClose }: Props) {
  const task = useTasks((s) => s.tasks.find((t) => t.id === taskId))
  const update = useTasks((s) => s.update)
  const archive = useTasks((s) => s.archive)
  const togglePin = useTasks((s) => s.togglePin)
  const spaces = useSpaces((s) => s.spaces)

  if (!task) return null
  const set = (patch: Parameters<typeof update>[1]) => update(task.id, patch)

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4">
        <input
          value={task.title}
          onChange={(e) => set({ title: e.target.value })}
          className="text-lg font-semibold outline-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Status
            <select
              value={task.status}
              onChange={(e) => isTaskStatus(e.target.value) && set({ status: e.target.value })}
              className={field}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Priority
            <select
              value={task.priority}
              onChange={(e) => isTaskPriority(e.target.value) && set({ priority: e.target.value })}
              className={field}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Due
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => set({ due: e.target.value || undefined })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Scheduled
            <input
              type="date"
              value={task.scheduled ?? ''}
              onChange={(e) => set({ scheduled: e.target.value || undefined })}
              className={field}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Space
            <select value={task.spaceId} onChange={(e) => set({ spaceId: e.target.value })} className={field}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={task.pinned}
              disabled={task.status === 'done'}
              onChange={() => togglePin(task.id)}
              className="h-4 w-4"
            />
            Pinned to Home
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Tags (comma separated)
          <input
            value={task.tags.join(', ')}
            onChange={(e) =>
              set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
            }
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Description
          <textarea
            value={task.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={6}
            className={field}
          />
        </label>

        <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
          <span>Created {task.createdAt.slice(0, 10)}</span>
          {/* Permanent delete lives only on the Archive page (Q28). */}
          <button
            onClick={() => {
              archive(task.id)
              onClose()
            }}
            className="rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100"
          >
            Archive
          </button>
        </div>
      </div>
    </Sheet>
  )
}
