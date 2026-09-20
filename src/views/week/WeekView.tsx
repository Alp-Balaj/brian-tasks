import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { blockNames, blocksInWeek, shiftDate, weekDays, weekOf, type WeekKey } from '../../domain/block'
import { useBlocks } from '../../store/blocks'
import { useToday } from '../../lib/useToday'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'
import { ChipButton, IconButton } from '../../components/ui'
import { DayRow } from './DayRow'
import { ROW_GRID } from './layout'
import { TimeRuler } from './TimeRuler'

/** "21–27 Sep 2026", "28 Sep – 4 Oct 2026", "29 Dec 2025 – 4 Jan 2026". */
function describeWeek(week: WeekKey): string {
  const a = new Date(`${week}T12:00:00`)
  const b = addDays(a, 6)
  if (a.getMonth() === b.getMonth()) return `${format(a, 'd')}–${format(b, 'd MMM yyyy')}`
  if (a.getFullYear() === b.getFullYear()) return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`
  return `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`
}

/** The `?w=` param as a week key: any valid date is taken to its Monday; anything else is this week. */
function weekFromParam(param: string | null, today: string): WeekKey {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(Date.parse(param))) return weekOf(param)
  return weekOf(today)
}

/**
 * The Week page (TB-19): seven day rows, 00–24, blocks and placements drawn to scale,
 * each day's unplaced tray, a legend of the week's block names. Navigable any distance
 * (TB-1) through `?w=<Monday>`; no param means this week. Gaps are the display: nothing
 * is totalled (TB-2). Editing happens in the sheets; this page only opens them.
 */
export function WeekView() {
  const [params, setParams] = useSearchParams()
  const today = useToday()
  const thisWeek = weekOf(today)
  const week = weekFromParam(params.get('w'), today)
  const days = useMemo(() => weekDays(week), [week])

  const blocks = useBlocks((s) => s.blocks)
  const legend = useMemo(() => blockNames(blocksInWeek(blocks, week)), [blocks, week])

  const go = (target: WeekKey) => setParams(target === thisWeek ? {} : { w: target })
  const relative = week === thisWeek ? 'This week' : week === shiftDate(thisWeek, 7) ? 'Next week' : week === shiftDate(thisWeek, -7) ? 'Last week' : undefined

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 p-3 pb-24 md:p-4 md:pb-4">
      <header className="flex items-center justify-between gap-2">
        <IconButton label="Previous week" onClick={() => go(shiftDate(week, -7))}>
          <ChevronLeftIcon />
        </IconButton>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{describeWeek(week)}</h1>
          {relative ? (
            <span className="text-xs text-fg-muted">{relative}</span>
          ) : (
            <ChipButton onClick={() => go(thisWeek)} className="mt-0.5 min-h-7 px-2.5 text-xs">
              This week
            </ChipButton>
          )}
        </div>
        <IconButton label="Next week" onClick={() => go(shiftDate(week, 7))}>
          <ChevronRightIcon />
        </IconButton>
      </header>

      {/* The legend is derived from the week's distinct block names (TB-3); nothing to define elsewhere. */}
      {legend.length > 0 && (
        <ul aria-label="Blocks this week" className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-fg-muted">
          {legend.map(({ name, colour }) => (
            <li key={name} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colour }} />
              {name}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <div className={ROW_GRID}>
          <div />
          <TimeRuler />
        </div>
        {days.map((date) => (
          <DayRow key={date} date={date} today={today} />
        ))}
      </div>

      {legend.length === 0 && (
        <p className="px-1 text-center text-xs text-fg-faint">No blocks this week. Tap a day's name to add one.</p>
      )}
    </div>
  )
}
