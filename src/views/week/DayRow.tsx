import { useMemo } from 'react'
import { format } from 'date-fns'
import type { ISODate } from '../../domain/task'
import {
  DAY,
  blocksOn,
  describeSpan,
  isStalePlacement,
  isTimed,
  placementsOn,
  unplacedOn,
  weekdayOf,
  type Placement,
} from '../../domain/block'
import { useBlocks } from '../../store/blocks'
import { useTasks } from '../../store/tasks'
import { useSpaces } from '../../store/spaces'
import { useShell } from '../../components/useShell'
import { PlusIcon } from '../../components/icons'
import { BlockBar } from './BlockBar'
import { PlacementBar } from './PlacementBar'
import { HatchLayer } from './HatchLayer'
import { Tray } from './Tray'
import { useNow } from '../../lib/useNow'
import { ROW_GRID, spanStyle } from './layout'
import { useRulerDrag } from './useRulerDrag'

interface Props {
  date: ISODate
  today: ISODate
  /** Off for Home's strip, which is today by definition (§5.6). */
  showLabel?: boolean
  /** Off for Home's strip: no tray there (TB-18). */
  showTray?: boolean
  /** Bars carry count badges only, never titles (TB-21, Home). */
  badgeOnly?: boolean
  /** Desktop drag to create, move and resize (TB-22). Off for Home's strip: editing lives on the Week page (TB-19). */
  editable?: boolean
}

/** Hour ticks every hour in `--line`; the quarter-day ticks are drawn stronger on top. */
const HOUR_TICKS = 'repeating-linear-gradient(90deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent calc(100% / 24))'

/**
 * One day of the week: the label (a button that starts a new block on that day), the
 * ruler with the day's blocks, placements, hatched overlaps and today's now-line, and
 * the tray of unplaced tasks. Reads the stores itself so Home can drop it in as the
 * today strip. All opening goes through the shell; the only writes are the desktop
 * drag's moves and resizes, inside `useRulerDrag`.
 */
export function DayRow({ date, today, showLabel = true, showTray = true, badgeOnly = false, editable = showLabel }: Props) {
  const blocks = useBlocks((s) => s.blocks)
  const placements = useBlocks((s) => s.placements)
  const tasks = useTasks((s) => s.tasks)
  const spaces = useSpaces((s) => s.spaces)
  const { openBlock, newBlock, openPlacement, placeTask } = useShell()
  const now = useNow()
  const drag = useRulerDrag(date, editable)
  const isToday = date === today
  const noon = new Date(`${date}T12:00:00`)

  const dayBlocks = useMemo(() => blocksOn(blocks, date), [blocks, date])
  const dayPlacements = useMemo(() => placementsOn(placements, date), [placements, date])
  const unplaced = useMemo(() => unplacedOn(tasks, placements, date), [tasks, placements, date])
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const spaceColour = (spaceId: string) => spaces.find((s) => s.id === spaceId)?.colour ?? '#d4d4d4'

  // Untimed placements are drawn inside their block (TB-8, TB-21); timed ones on the grid (TB-12).
  const untimedIn = (blockId: string) =>
    dayPlacements
      .filter((p) => !isTimed(p) && p.blockId === blockId)
      .map((p) => taskById.get(p.taskId))
      .filter((t) => t !== undefined)
  const timed = dayPlacements.filter((p): p is Placement & { start: number; end: number } => isTimed(p))
  // A bar under the pointer is drawn where it is being dragged to, hatching included.
  const shownBlocks = dayBlocks.map((b) => drag.previewed('block', b.id, b))
  const shownTimed = timed.map((p) => drag.previewed('placement', p.id, p))
  const choice = drag.choice

  return (
    <div className={`${ROW_GRID} items-center`}>
      {showLabel && (
        <button
          type="button"
          onClick={() => newBlock(date, { weekday: weekdayOf(date) })}
          title="New block"
          aria-label={`New block on ${format(noon, 'EEEE d MMMM')}`}
          className={`group relative flex h-10 flex-col items-center justify-center rounded-lg leading-none hover:bg-surface-2 md:h-11 ${
            isToday ? 'text-accent' : 'text-fg-muted'
          }`}
        >
          <span className="text-[11px] font-medium">{format(noon, 'EEE')}</span>
          <span className={`mt-0.5 text-[15px] tabular-nums ${isToday ? 'font-semibold' : ''}`}>{format(noon, 'd')}</span>
          <span className="absolute -right-1 -top-1 hidden rounded-full bg-surface-3 p-0.5 text-fg-muted group-hover:grid">
            <PlusIcon size={10} strokeWidth={3} />
          </span>
        </button>
      )}

      <div className={`relative ${showLabel ? '' : 'col-span-full'}`}>
        {/* `isolate`: the bars' z-order (hatch, placements, now-line) stays inside the ruler, under sheets and the tab bar. */}
        <div
          {...drag.rulerProps}
          className={`relative isolate h-10 overflow-hidden rounded-md bg-surface ring-1 ring-line md:h-11 ${drag.enabled ? 'cursor-crosshair select-none' : ''}`}
          style={{ backgroundImage: HOUR_TICKS }}
        >
          {[6, 12, 18].map((h) => (
            <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${(h / 24) * 100}%` }} />
          ))}

          {shownBlocks.map((b) => (
            <BlockBar
              key={b.id}
              block={b}
              tasks={untimedIn(b.id)}
              badgeOnly={badgeOnly}
              onOpen={() => openBlock(b.id, date)}
              drag={drag.bar('block', b.id, b, () => openBlock(b.id, date))}
            />
          ))}

          <HatchLayer blocks={shownBlocks} placements={shownTimed} />

          {shownTimed.map((p) => {
            const task = taskById.get(p.taskId)
            if (!task) return null
            return (
              <PlacementBar
                key={p.id}
                placement={p}
                task={task}
                colour={spaceColour(task.spaceId)}
                stale={isStalePlacement(p, task, placements)}
                badgeOnly={badgeOnly}
                onOpen={() => openPlacement(p.id, date)}
                drag={drag.bar('placement', p.id, p, () => openPlacement(p.id, date))}
              />
            )
          })}

          {/* The span being dragged out on empty time, kept up while the choice below is open (TB-13). */}
          {drag.ghost && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-30 flex items-center justify-center overflow-hidden rounded-md bg-accent-soft text-[10px] font-medium tabular-nums text-accent ring-1 ring-accent ring-inset"
              style={spanStyle(drag.ghost.start, drag.ghost.end)}
            >
              <span className="truncate px-1">{describeSpan(drag.ghost.start, drag.ghost.end)}</span>
            </span>
          )}

          {isToday && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-40 w-px bg-accent"
              style={{ left: `${(now / DAY) * 100}%` }}
            >
              <span className="absolute -top-px -left-[2.5px] h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          )}
        </div>

        {/* TB-13 Path B: a drag on empty time ends here — new block, or a task in that span. */}
        {choice && (
          <div
            data-drag-choice
            role="dialog"
            aria-label={`${describeSpan(choice.start, choice.end)} on ${format(noon, 'EEEE d MMMM')}`}
            className="absolute top-full z-10 mt-1 flex w-max -translate-x-1/2 flex-col rounded-xl bg-surface p-1 shadow-lg ring-1 ring-line"
            style={{ left: choice.x }}
          >
            <span className="px-2.5 pt-1 pb-0.5 text-[11px] tabular-nums text-fg-faint">{describeSpan(choice.start, choice.end)}</span>
            <button
              type="button"
              autoFocus
              onClick={() => {
                drag.dismiss()
                newBlock(date, { weekday: weekdayOf(date), start: choice.start, end: choice.end })
              }}
              className="rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              New block
            </button>
            <button
              type="button"
              onClick={() => {
                drag.dismiss()
                placeTask(null, date, { start: choice.start, end: choice.end })
              }}
              className="rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              Place a task
            </button>
          </div>
        )}
      </div>

      {showTray && (
        <Tray
          date={date}
          tasks={unplaced}
          onPlace={(task) => placeTask(task, date)}
          className={showLabel ? 'col-start-2 md:col-start-auto' : 'col-span-full'}
        />
      )}
    </div>
  )
}
