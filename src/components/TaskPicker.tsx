import { useMemo, useState, type KeyboardEvent } from 'react'
import { useTasks } from '../store/tasks'
import { useBlocks } from '../store/blocks'
import { useSpaces } from '../store/spaces'
import { unplacedOn } from '../domain/block'
import { PRIORITY_RANK, type ISODate, type Task } from '../domain/task'
import { formatDay } from '../lib/dates'
import { useToday } from '../lib/useToday'
import { DueChip, PriorityMark, SpaceDot } from './TaskCard'
import { SectionLabel, field } from './ui'

interface Props {
  /** The day being planned: its unplaced Scheduled tasks come first (TB-10). */
  date: ISODate
  onPick: (task: Task) => void
  /** Tasks not to offer, e.g. the ones already in this block on this day. */
  excludeIds?: readonly string[]
}

/** A mouse or trackpad is driving: the search box can take focus without a keyboard covering the list. */
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

const byPriority = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)

/**
 * Pick a Task to place (§5.5), shared by BlockSheet and PlacementSheet. Two sections:
 * that day's unplaced Scheduled tasks, then every open task, both narrowed by the
 * search box (TB-10). Spans every Space like Home, so each row carries its Space dot.
 * Done and Archived tasks are never offered. Arrow keys move through the list from
 * the search box; Enter picks.
 */
export function TaskPicker({ date, onPick, excludeIds = [] }: Props) {
  const tasks = useTasks((s) => s.tasks)
  const placements = useBlocks((s) => s.placements)
  const today = useToday()
  const [query, setQuery] = useState('')
  // Keyboard cursor; null until the arrow keys are used, so nothing looks pre-chosen on a phone.
  const [active, setActive] = useState<number | null>(null)

  const { unplaced, open } = useMemo(() => {
    const excluded = new Set(excludeIds)
    const q = query.trim().toLowerCase()
    const matches = (t: Task) => !excluded.has(t.id) && (q === '' || t.title.toLowerCase().includes(q))
    const unplaced = unplacedOn(tasks, placements, date).filter(matches)
    const first = new Set(unplaced.map((t) => t.id))
    const open = tasks
      .filter((t) => !t.archived && t.status !== 'done' && !first.has(t.id) && matches(t))
      .sort(byPriority)
    return { unplaced, open }
  }, [tasks, placements, date, excludeIds, query])

  // One flat list for keyboard navigation across both sections.
  const items = useMemo(() => [...unplaced, ...open], [unplaced, open])
  const current = active === null ? null : Math.min(active, items.length - 1)

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min((current ?? -1) + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max((current ?? 0) - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter with no cursor takes the top match, so typing a title and pressing Enter is enough.
      const pick = items[current ?? 0]
      if (!pick) return
      e.preventDefault()
      onPick(pick)
    }
  }

  const optionId = (task: Task) => `task-pick-${task.id}`
  const row = (task: Task, index: number) => (
    <li key={task.id}>
      <PickRow task={task} active={index === current} id={optionId(task)} onPick={() => onPick(task)} />
    </li>
  )

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        role="combobox"
        aria-expanded
        aria-controls="task-pick-list"
        aria-activedescendant={current !== null && items[current] ? optionId(items[current]) : undefined}
        aria-label="Search tasks"
        autoFocus={finePointer()}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(null)
        }}
        onKeyDown={onKeyDown}
        placeholder="Search open tasks"
        className={field}
      />

      <div id="task-pick-list" role="listbox" aria-label="Tasks" className="flex flex-col gap-4">
        {unplaced.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel className="px-1">Unplaced {formatDay(date, today)}</SectionLabel>
            <ul className="flex flex-col">{unplaced.map(row)}</ul>
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <SectionLabel className="px-1">All open tasks</SectionLabel>
          {open.length > 0 ? (
            <ul className="flex flex-col">{open.map((t, i) => row(t, unplaced.length + i))}</ul>
          ) : (
            <p className="px-1 py-2 text-sm text-fg-faint">
              {items.length === 0 && query.trim() ? 'No open tasks match.' : 'No other open tasks.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

/** One candidate: Space dot, title, priority mark, due chip. A 48px tap target. */
function PickRow({ task, active, id, onPick }: { task: Task; active: boolean; id: string; onPick: () => void }) {
  const space = useSpaces((s) => s.spaces.find((sp) => sp.id === task.spaceId))
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={active}
      onClick={onPick}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left hover:bg-surface-2 ${
        active ? 'bg-surface-2' : ''
      }`}
    >
      <SpaceDot colour={space?.colour ?? '#d4d4d4'} title={space?.name} />
      <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug">{task.title}</span>
      <PriorityMark priority={task.priority} />
      {task.due && <DueChip due={task.due} />}
    </button>
  )
}
