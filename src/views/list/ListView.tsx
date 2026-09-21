import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRIORITY_RANK, STATUS_LABEL, TASK_STATUSES, type Task, type TaskStatus } from '../../domain/task'
import { useTasks } from '../../store/tasks'
import { useSpaces } from '../../store/spaces'
import { useSpaceSelection } from '../../store/ui'
import { useVisibleTasks } from '../../store/selectors'
import { ALL_SPACES } from '../../domain/space'
import { useShell } from '../../components/useShell'
import { DueChip, SpaceDot, TaskMarks } from '../../components/TaskCard'
import { RowGroup, TaskRow } from '../../components/TaskRow'
import { Chip, field } from '../../components/ui'
import { useToday } from '../../lib/useToday'

type SortKey = 'priority' | 'due' | 'created' | 'title'

const SORTERS: Record<SortKey, (a: Task, b: Task) => number> = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  due: (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title: (a, b) => a.title.localeCompare(b.title),
}

const select = `${field} min-h-10 flex-1 pr-8 text-sm sm:w-auto sm:flex-none`

/** Flat list with status filter, text search and sort. The check completes / reopens. */
export function ListView() {
  const tasks = useVisibleTasks()
  const update = useTasks((s) => s.update)
  const { openTask } = useShell()
  const today = useToday()
  // Q30: the space dot is only shown when the list mixes spaces.
  const showSpace = useSpaceSelection((s) => s.selected === ALL_SPACES)
  const spaces = useSpaces((s) => s.spaces)
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces])

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
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24 md:pb-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className={`${field} min-h-10 min-w-0 sm:flex-1`}
        />
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Status filter"
            className={select}
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
            aria-label="Sort"
            className={select}
          >
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="created">Newest</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>

      <RowGroup>
        {visible.length === 0 && <li className="p-8 text-center text-sm text-fg-faint">Nothing here.</li>}
        {visible.map((t) => {
          const space = showSpace ? spaceById.get(t.spaceId) : undefined
          const done = t.status === 'done'
          return (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={() => openTask(t.id)}
              onToggleDone={(next) => update(t.id, { status: next ? 'done' : 'todo' })}
              meta={
                <>
                  {space && (
                    <span className="inline-flex items-center gap-1">
                      <SpaceDot colour={space.colour} />
                      {space.name}
                    </span>
                  )}
                  {t.status !== 'todo' && t.status !== 'done' && <span>{STATUS_LABEL[t.status]}</span>}
                  {t.due && <DueChip due={t.due} done={done} today={today} />}
                  <TaskMarks task={t} />
                  {t.tags.map((tag) => (
                    <Chip key={tag}>{tag}</Chip>
                  ))}
                </>
              }
            />
          )
        })}
      </RowGroup>
      <div className="flex items-center justify-between px-1 text-xs text-fg-faint">
        <Link to="/archive" className="hover:text-fg hover:underline">
          Archive
        </Link>
        <span>
          {visible.length} task{visible.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}
