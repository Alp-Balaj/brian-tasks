import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ISODate } from '../../domain/task'
import {
  DAY,
  blocksOn,
  currentBlock,
  describeMinutes,
  describeSpan,
  isTimed,
  overlapRegions,
  placementsOn,
  type Block,
  type Minutes,
  type Placement,
} from '../../domain/block'
import { useBlocks } from '../../store/blocks'
import { useTasks } from '../../store/tasks'
import { useSpaces } from '../../store/spaces'
import { useShell } from '../../components/useShell'
import { useNow } from './useNow'

/** Hour ticks under the strip (§5.6): label and where it sits along the day. */
const TICKS: { label: string; at: Minutes }[] = [
  { label: '00', at: 0 },
  { label: '06', at: 360 },
  { label: '12', at: 720 },
  { label: '18', at: 1080 },
  { label: '24', at: DAY },
]

const left = (m: Minutes) => `${(m / DAY) * 100}%`
const width = (start: Minutes, end: Minutes) => `${((end - start) / DAY) * 100}%`

/**
 * Today at the very top of Home (TB-20): blocks and timed placements drawn to scale,
 * the now-line, and one "Now ·" line under it. Bars carry no titles, only the count
 * badge (TB-21); hover/long-press reveals the name via `title`. Tapping a block opens
 * its sheet, tapping a placement opens the task. Nothing is written from here.
 *
 * The bars below are a deliberately minimal stand-in: P1 is building the reusable
 * `DayRow` (`src/views/week/DayRow.tsx`) in parallel, and P6 swaps it in here with no
 * label and no tray. Keep this file's height budget when doing so: ≤ 56px for the
 * ruler plus ticks, then the Now line.
 */
export function TodayStrip({ today }: { today: ISODate }) {
  const blocks = useBlocks((s) => s.blocks)
  const placements = useBlocks((s) => s.placements)
  const tasks = useTasks((s) => s.tasks)
  const spaces = useSpaces((s) => s.spaces)
  const { openBlock, openTask } = useShell()
  const now = useNow()

  const todayBlocks = useMemo(() => blocksOn(blocks, today), [blocks, today])
  const todayPlacements = useMemo(() => placementsOn(placements, today), [placements, today])
  const timed = useMemo(() => todayPlacements.filter(isTimed), [todayPlacements])
  const hatch = useMemo(() => overlapRegions([...todayBlocks, ...timed]), [todayBlocks, timed])

  if (todayBlocks.length === 0 && todayPlacements.length === 0) {
    return (
      <Link to="/week" className="self-start px-1 text-sm font-medium text-accent hover:underline">
        Plan your week →
      </Link>
    )
  }

  // TB-21: Home's strip always uses the badge, so an untimed link is a number on the block.
  const untimedCount = (block: Block) =>
    todayPlacements.filter((p) => p.blockId === block.id && !isTimed(p)).length

  const taskOf = (p: Placement) => tasks.find((t) => t.id === p.taskId)
  const spaceColour = (spaceId: string | undefined) => spaces.find((s) => s.id === spaceId)?.colour ?? '#d4d4d4'

  return (
    <section className="flex flex-col gap-1 px-1" aria-label="Today's blocks">
      {/* Ruler: 40px of bars, then a 14px tick row — 54px, inside the glanceable budget. */}
      <div className="relative h-10 overflow-hidden rounded-lg bg-surface">
        {todayBlocks.map((b) => {
          const count = untimedCount(b)
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => openBlock(b.id, today)}
              title={`${b.name} · ${describeSpan(b.start, b.end)}`}
              aria-label={`${b.name}, ${describeSpan(b.start, b.end)}${count > 0 ? `, ${count} tasks` : ''}`}
              className="absolute inset-y-0 flex min-w-0.5 items-center justify-end rounded-sm px-1 opacity-90 hover:opacity-100"
              style={{ left: left(b.start), width: width(b.start, b.end), backgroundColor: b.colour }}
            >
              {count > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-semibold leading-4 text-white tabular-nums">
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Overlaps (TB-6, TB-12): hatched in the foreground colour, above blocks, below placements. */}
        {hatch.map((r) => (
          <div
            key={`${r.start}-${r.end}`}
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: left(r.start),
              width: width(r.start, r.end),
              backgroundImage:
                'repeating-linear-gradient(135deg, var(--fg) 0 1px, transparent 1px 5px)',
              opacity: 0.18,
            }}
          />
        ))}

        {timed.map((p) => {
          const task = taskOf(p)
          if (!task) return null
          const done = task.status === 'done'
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openTask(task.id)}
              title={`${task.title} · ${describeSpan(p.start, p.end)}`}
              aria-label={`${task.title}, ${describeSpan(p.start, p.end)}${done ? ', done' : ''}`}
              // Bottom 45% of the row, outlined in the task's Space colour; done = dimmed (TB-16).
              className={`absolute bottom-0 h-[45%] min-w-0.5 rounded-sm bg-surface/80 ${done ? 'opacity-40' : ''}`}
              style={{
                left: left(p.start),
                width: width(p.start, p.end),
                border: `1.5px solid ${spaceColour(task.spaceId)}`,
              }}
            />
          )
        })}

        {/* Now-line, from the minute ticker. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: left(now) }} />
      </div>

      <div aria-hidden className="relative h-3.5 text-[10px] leading-none text-fg-faint tabular-nums">
        {TICKS.map(({ label, at }) => (
          <span
            key={label}
            className="absolute top-0"
            style={{
              left: left(at),
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
