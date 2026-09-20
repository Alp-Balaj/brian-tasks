import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ISODate } from '../../domain/task'
import { DAY, blocksOn, currentBlock, describeMinutes, placementsOn, type Block, type Minutes } from '../../domain/block'
import { useBlocks } from '../../store/blocks'
import { useNow } from '../../lib/useNow'
import { DayRow } from '../week/DayRow'

/** Hour ticks under the strip (§5.6): label and where it sits along the day. */
const TICKS: { label: string; at: Minutes }[] = [
  { label: '00', at: 0 },
  { label: '06', at: 360 },
  { label: '12', at: 720 },
  { label: '18', at: 1080 },
  { label: '24', at: DAY },
]

/**
 * Today at the very top of Home (TB-20): the Week page's `DayRow` for today with no
 * label and no tray, bars carrying count badges only (TB-21), the now-line, and one
 * "Now ·" line under it. Tapping a block opens its sheet, tapping a placement its
 * sheet. Nothing is written from here. Rendered only when today has anything on it;
 * otherwise a single link to the Week page.
 */
export function TodayStrip({ today }: { today: ISODate }) {
  const blocks = useBlocks((s) => s.blocks)
  const placements = useBlocks((s) => s.placements)
  const now = useNow()

  const todayBlocks = useMemo(() => blocksOn(blocks, today), [blocks, today])
  const hasPlacements = useMemo(() => placementsOn(placements, today).length > 0, [placements, today])

  if (todayBlocks.length === 0 && !hasPlacements) {
    return (
      <Link to="/week" className="self-start px-1 text-sm font-medium text-accent hover:underline">
        Plan your week →
      </Link>
    )
  }

  return (
    <section className="flex flex-col gap-1 px-1" aria-label="Today's blocks">
      {/* Ruler: one row of bars (40px phone / 44px desktop), then a 14px tick row — inside the glanceable budget. */}
      <DayRow date={today} today={today} showLabel={false} showTray={false} badgeOnly />

      <div aria-hidden className="relative h-3.5 text-[10px] leading-none text-fg-faint tabular-nums">
        {TICKS.map(({ label, at }) => (
          <span
            key={label}
            className="absolute top-0"
            style={{
              left: `${(at / DAY) * 100}%`,
              transform: at === 0 ? undefined : at === DAY ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <NowLine blocks={todayBlocks} today={today} now={now} />
    </section>
  )
}

/**
 * "Now · Job until 17:00" or "Open time until 09:00". Not a computed total (TB-2,
 * TB-23) — just the block under way, or the next one's start.
 */
function NowLine({ blocks, today, now }: { blocks: Block[]; today: ISODate; now: Minutes }) {
  const current = currentBlock(blocks, today, now)
  if (current) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-fg">
        <span className="text-fg-muted">Now ·</span>
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: current.colour }} />
        <span className="truncate font-medium">{current.name}</span>
        <span className="text-fg-muted">until {describeMinutes(current.end)}</span>
      </p>
    )
  }
  const next = blocks.find((b) => b.start > now)
  return (
    <p className="text-sm text-fg-muted">
      {next ? `Open time until ${describeMinutes(next.start)}` : 'Open time for the rest of the day'}
    </p>
  )
}
