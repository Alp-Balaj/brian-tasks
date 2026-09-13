import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PRIORITY_LABEL,
  PRIORITY_RANK,
  STATUS_LABEL,
  TASK_STATUSES,
  type Task,
  type TaskStatus,
} from '../../domain/task'
import { useTasks } from '../../store/tasks'
import { useVisibleTasks } from '../../store/selectors'
import { useShell } from '../../components/useShell'

type SortKey = 'priority' | 'due' | 'created' | 'title'

const SORTERS: Record<SortKey, (a: Task, b: Task) => number> = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  due: (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title: (a, b) => a.title.localeCompare(b.title),
}

/** Flat list with status filter, text search and sort. Checkbox toggles done. */
export function ListView() {
  const tasks = useVisibleTasks()
  const update = useTasks((s) => s.update)
  const { openTask } = useShell()

  const [status, setStatus] = useState<TaskStatus | 'all' | 'active'>('active')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('priority')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks
      .filter((t) => (status === 'all' ? true : status === 'active' ? t.status !== 'done' : t.status === status))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)))
      .sort(SORTERS[sort])
  }, [tasks, status, query, sort])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="active">Active</option>
          <option value="all">All</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="priority">Priority</option>
          <option value="due">Due date</option>
          <option value="created">Newest</option>
          <option value="title">Title</option>
        </select>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {visible.length === 0 && <li className="p-6 text-center text-sm text-neutral-400">Nothing here.</li>}
        {visible.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={t.status === 'done'}
              onChange={(e) => update(t.id, { status: e.target.checked ? 'done' : 'todo' })}
              className="h-4 w-4 shrink-0"
            />
            <button onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left">
              <div className={`truncate text-sm ${t.status === 'done' ? 'text-neutral-400 line-through' : ''}`}>
                {t.title}
              </div>
              <div className="flex gap-2 text-xs text-neutral-500">
                <span>{STATUS_LABEL[t.status]}</span>
                {t.priority !== 'normal' && <span>· {PRIORITY_LABEL[t.priority]}</span>}
                {t.due && <span>· due {t.due}</span>}
                {t.tags.length > 0 && <span>· {t.tags.join(', ')}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="text-right text-xs text-neutral-400">{visible.length} tasks</div>
      <div className="text-right text-xs">
        <Link to="/archive" className="text-neutral-400 hover:text-neutral-900">
          Archive
        </Link>
      </div>
    </div>
  )
}
