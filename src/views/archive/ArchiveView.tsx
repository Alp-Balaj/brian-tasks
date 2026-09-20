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
import { RowGroup } from '../../components/TaskRow'
import { SectionLabel } from '../../components/ui'

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-24 md:pb-4">
      <h1 className="px-1 text-2xl font-semibold tracking-tight">Archive</h1>

      <section className="flex flex-col gap-1.5">
        <SectionLabel className="px-1">Tasks</SectionLabel>
        <RowGroup>
          {archived.length === 0 && (
            <li className="p-8 text-center text-sm text-fg-faint">
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
        </RowGroup>
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionLabel className="px-1">Routines</SectionLabel>
        <RowGroup>
          {archivedRoutines.length === 0 && (
            <li className="p-8 text-center text-sm text-fg-faint">No archived routines.</li>
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
        </RowGroup>
      </section>
    </div>
  )
}
