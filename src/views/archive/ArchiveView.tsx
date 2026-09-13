import { useMemo } from 'react'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../domain/task'
import { ALL_SPACES } from '../../domain/space'
import type { Schedule, Weekday } from '../../domain/routine'
import { useTasks } from '../../store/tasks'
import { useRoutines } from '../../store/routines'
import { useSpaces } from '../../store/spaces'
import { useSpaceSelection } from '../../store/ui'
import { archivedTasks } from '../../store/selectors'
import { ArchiveRow } from './ArchiveRow'

const WEEKDAY_SHORT: Record<Weekday, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

const scheduleSummary = (s: Schedule) =>
  s.kind === 'daily'
    ? 'Every day'
    : s.days.length === 0
      ? 'No days'
      : [...s.days]
          .sort((a, b) => a - b)
          .map((d) => WEEKDAY_SHORT[d])
          .join(', ')

/** Most recently archived first — `archive()` bumps `updatedAt`. */
const newestFirst = <T extends { updatedAt: string }>(items: T[]) =>
  [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

/**
 * The one place Archived Tasks and Routines can be seen, restored or permanently deleted.
 * Tasks obey the space switcher (Q27); Routines have no space, so all archived ones show (Q20).
 */
export function ArchiveView() {
  const tasks = useTasks((s) => s.tasks)
  const restoreTask = useTasks((s) => s.restore)
  const removeTask = useTasks((s) => s.remove)
  const routines = useRoutines((s) => s.routines)
  const restoreRoutine = useRoutines((s) => s.restore)
  const removeRoutine = useRoutines((s) => s.remove)
  const spaces = useSpaces((s) => s.spaces)
  const selected = useSpaceSelection((s) => s.selected)

  const archived = useMemo(() => newestFirst(archivedTasks(tasks, selected)), [tasks, selected])
  const archivedRoutines = useMemo(() => newestFirst(routines.filter((r) => r.archived)), [routines])
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces])
  const showDot = selected === ALL_SPACES

  const confirmDelete = (what: string, title: string, remove: () => void) => {
    if (confirm(`Permanently delete ${what} "${title}"? This cannot be undone.`)) remove()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3">
      <h1 className="text-lg font-semibold">Archive</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">Tasks</h2>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {archived.length === 0 && (
            <li className="p-6 text-center text-sm text-neutral-400">
              {showDot ? 'No archived tasks.' : 'No archived tasks in this space.'}
            </li>
          )}
          {archived.map((t) => {
            const space = spaceById.get(t.spaceId)
            return (
              <ArchiveRow
                key={t.id}
                title={t.title}
                secondary={[STATUS_LABEL[t.status], PRIORITY_LABEL[t.priority], space?.name ?? t.spaceId].join(' · ')}
                colour={showDot ? space?.colour : undefined}
                onRestore={() => restoreTask(t.id)}
                onDelete={() => confirmDelete('task', t.title, () => removeTask(t.id))}
              />
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">Routines</h2>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {archivedRoutines.length === 0 && (
            <li className="p-6 text-center text-sm text-neutral-400">No archived routines.</li>
          )}
          {archivedRoutines.map((r) => (
            <ArchiveRow
              key={r.id}
              title={r.title}
              secondary={scheduleSummary(r.schedule)}
              onRestore={() => restoreRoutine(r.id)}
              onDelete={() => confirmDelete('routine', r.title, () => removeRoutine(r.id))}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
