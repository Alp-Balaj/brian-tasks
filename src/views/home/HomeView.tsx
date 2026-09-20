import { useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../domain/task'
import { useTasks } from '../../store/tasks'
import { useRoutines } from '../../store/routines'
import { useShell } from '../../components/useShell'
import { useToday } from '../../lib/useToday'
import { RowGroup } from '../../components/TaskRow'
import { ChipButton, SectionLabel } from '../../components/ui'
import { CloseIcon } from '../../components/icons'
import { RoutinesSection } from './RoutinesSection'
import { HomeTaskRow } from './HomeTaskRow'
import { homeSections } from '../../domain/home'

/** Rows shown per section before "Show more" (Q5: Home is glanceable, not exhaustive). */
const CAP = 5

function Section<T>({
  title,
  items,
  tone = 'neutral',
  render,
}: {
  title: string
  items: T[]
  tone?: 'neutral' | 'danger'
  render: (item: T) => ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const shown = expanded ? items : items.slice(0, CAP)
  const hidden = items.length - shown.length
  return (
    <section className="flex flex-col gap-1.5">
      <SectionLabel className={`flex items-baseline gap-2 px-1 ${tone === 'danger' ? 'text-danger' : ''}`}>
        {title}
        <span className={`font-normal ${tone === 'danger' ? 'text-danger/70' : 'text-fg-faint'}`}>{items.length}</span>
      </SectionLabel>
      <RowGroup>{shown.map(render)}</RowGroup>
      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="self-start px-2 py-1 text-xs font-medium text-fg-muted hover:text-fg"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  )
}

/**
 * Landing page: Overdue · Routines · Today · Pinned · In progress, across every Space
 * (Q3, Q24). A task just checked off here lingers struck-through in its section until
 * you leave Home, so an accidental tap is one more tap to undo (Q6).
 */
export function HomeView() {
  const tasks = useTasks((s) => s.tasks)
  const update = useTasks((s) => s.update)
  const togglePin = useTasks((s) => s.togglePin)
  const { openTask } = useShell()
  const today = useToday()

  // Snapshot of each task as it was just before being completed on this visit. Sections
  // are placed from the snapshot; rows render the live task (struck through). Snapshots
  // from an earlier day are ignored, so an open tab starts clean after midnight.
  const [lingering, setLingering] = useState<{ day: string; map: Map<string, Task> }>(() => ({ day: today, map: new Map() }))
  const linger = useMemo(() => (lingering.day === today ? lingering.map : new Map<string, Task>()), [lingering, today])
  const setLinger = (fn: (m: Map<string, Task>) => Map<string, Task>) => setLingering({ day: today, map: fn(linger) })

  const live = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const placed = useMemo(
    () => tasks.map((t) => (t.status === 'done' ? (linger.get(t.id) ?? t) : t)),
    [tasks, linger],
  )
  const { overdue, today: todayRows, pinned, inProgress } = useMemo(() => homeSections(placed, today), [placed, today])

  const setDone = (task: Task, done: boolean) => {
    if (done) {
      setLinger((m) => new Map(m).set(task.id, task))
      update(task.id, { status: 'done' })
    } else {
      // Undo goes back to where the task was, not to "to do".
      update(task.id, { status: linger.get(task.id)?.status ?? 'todo' })
      setLinger((m) => {
        const next = new Map(m)
        next.delete(task.id)
        return next
      })
    }
  }

  const row = (task: Task, extra?: { reason?: 'due today' | 'scheduled'; trailing?: ReactNode }) => {
    const current = live.get(task.id) ?? task
    return (
      <HomeTaskRow
        key={task.id}
        task={current}
        reason={extra?.reason}
        onOpen={() => openTask(task.id)}
        onToggleDone={(done) => setDone(current, done)}
        trailing={extra?.trailing}
      />
    )
  }

  // RoutinesSection always renders its "+ routine" affordance (see the note there), so
  // "empty" here means no live Routines rather than nothing rendered above.
  const hasRoutines = useRoutines((s) => s.routines.some((r) => !r.archived))
  const empty =
    !hasRoutines && overdue.length === 0 && pinned.length === 0 && todayRows.length === 0 && inProgress.length === 0

  const summary = [
    overdue.length > 0 && `${overdue.length} overdue`,
    todayRows.length > 0 && `${todayRows.length} today`,
    inProgress.length > 0 && `${inProgress.length} in progress`,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-24 md:pb-4">
      <header className="px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{format(new Date(`${today}T12:00:00`), 'EEEE d MMMM')}</h1>
        <p className="mt-0.5 text-sm text-fg-muted">{summary.length > 0 ? summary.join(' · ') : 'Nothing due.'}</p>
      </header>

      <Section
        title="Overdue"
        tone="danger"
        items={overdue}
        render={(t) =>
          row(t, {
            trailing:
              live.get(t.id)?.status === 'done' ? undefined : (
                <ChipButton onClick={() => update(t.id, { due: today })} className="min-h-8 px-2.5 text-xs" title="Move due date to today">
                  → Today
                </ChipButton>
              ),
          })
        }
      />

      <RoutinesSection today={today} />

      <Section title="Today" items={todayRows} render={({ task, reason }) => row(task, { reason })} />

      <Section
        title="Pinned"
        items={pinned}
        render={(t) =>
          row(t, {
            trailing: (
              <button
                onClick={() => togglePin(t.id)}
                title="Unpin from Home"
                aria-label="Unpin from Home"
                className="grid h-11 w-9 shrink-0 place-items-center text-fg-faint hover:text-fg"
              >
                <CloseIcon size={16} />
              </button>
            ),
          })
        }
      />

      <Section title="In progress" items={inProgress} render={(t) => row(t)} />

      {empty && <p className="py-10 text-center text-sm text-fg-faint">Nothing needs you right now.</p>}
    </div>
  )
}
