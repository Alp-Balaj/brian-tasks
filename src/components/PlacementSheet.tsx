import { useState } from 'react'
import { useBlocks } from '../store/blocks'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { Sheet } from './Sheet'
import { TaskPicker } from './TaskPicker'
import { SpaceDot } from './TaskCard'
import { ChevronLeftIcon } from './icons'
import { Button, ChipButton, SectionLabel, field } from './ui'
import { formatDay } from '../lib/dates'
import { useToday } from '../lib/useToday'
import type { ISODate, Task } from '../domain/task'
import { WEEKDAYS_MONDAY_FIRST, WEEKDAY_SHORT, type Weekday } from '../domain/routine'
import {
  DAY,
  STEP,
  blocksOn,
  dateInWeek,
  describeMinutes,
  describeSpan,
  weekOf,
  weekdayOf,
  type Block,
  type Minutes,
  type NewPlacement,
  type PlacementPatch,
} from '../domain/block'

interface Props {
  /** `null` creates a new placement (Path B, TB-13); the form is a local draft until "Add". */
  placementId: string | null
  date: ISODate
  preset?: { start?: Minutes; end?: Minutes; taskId?: string }
  onClose: () => void
}

/** The draft of a new placement: a task, a day, and a block and/or a time (D3). */
type Draft = Omit<NewPlacement, 'taskId'> & { taskId?: string }

/** The one-hour default when a time is first set: the block's start, else 09:00. */
const defaultSpan = (block?: Block): { start: Minutes; end: Minutes } => {
  const start = block?.start ?? 540
  return { start, end: Math.min(start + 60, block?.end ?? DAY) }
}

/**
 * Put a Task on a day (§5.4): the phone form and desktop Path B (TB-13). Task, day,
 * time and "in block" — at least one of block and time, since a placement is one or
 * both (D3). A new one is a draft until "Add"; an existing one saves every change
 * immediately, like TaskEditor. The Task's Scheduled follows from the store (TB-15,
 * D9); nothing here writes it.
 */
export function PlacementSheet({ placementId, date, preset, onClose }: Props) {
  const placement = useBlocks((s) => (placementId ? s.placements.find((p) => p.id === placementId) : undefined))
  const blocks = useBlocks((s) => s.blocks)
  const addPlacement = useBlocks((s) => s.addPlacement)
  const updatePlacement = useBlocks((s) => s.updatePlacement)
  const removePlacement = useBlocks((s) => s.removePlacement)
  const tasks = useTasks((s) => s.tasks)
  const today = useToday()

  const [draft, setDraft] = useState<Draft>(() => ({
    date,
    taskId: preset?.taskId,
    ...(preset?.start !== undefined && preset?.end !== undefined ? { start: preset.start, end: preset.end } : {}),
  }))
  // A new placement with no task yet opens straight on the picker: it is the first thing needed.
  const [picking, setPicking] = useState(placementId === null && preset?.taskId === undefined)

  const isNew = placementId === null
  if (!isNew && !placement) return null

  const value: Draft = isNew ? draft : placement!
  const task = value.taskId ? tasks.find((t) => t.id === value.taskId) : undefined
  const timed = value.start !== undefined && value.end !== undefined
  const week = weekOf(value.date)
  const dayBlocks = blocksOn(blocks, value.date)
  const block = value.blockId ? dayBlocks.find((b) => b.id === value.blockId) : undefined

  const set = (patch: PlacementPatch) => {
    if (isNew) setDraft((d) => ({ ...d, ...patch }))
    else updatePlacement(placementId, patch)
  }

  /**
   * Another day. The block link only survives if that block is on the new day;
   * otherwise it is dropped, and an untimed placement gets a time so it still has
   * something to draw (D3).
   */
  const setDay = (weekday: Weekday) => {
    const next = dateInWeek(week, weekday)
    if (next === value.date) return
    if (block === undefined) set({ date: next })
    else if (blocksOn(blocks, next).some((b) => b.id === block.id)) set({ date: next })
    else set({ date: next, blockId: undefined, ...(timed ? {} : defaultSpan()) })
  }

  const setBlock = (next?: Block) => {
    if (next === undefined) set({ blockId: undefined })
    // Moving into a block: an untimed placement is "sometime during it" (TB-8), so any time it had is kept as is.
    else set({ blockId: next.id })
  }

  const clearTime = () => set({ start: undefined, end: undefined })

  const ready = value.taskId !== undefined && (value.blockId !== undefined || timed)
  const submit = () => {
    if (!ready || !isNew) return
    addPlacement({ taskId: value.taskId!, date: value.date, blockId: value.blockId, start: value.start, end: value.end })
    onClose()
  }

  if (picking) {
    return (
      <Sheet
        onClose={() => (task ? setPicking(false) : onClose())}
        title={
          task ? (
            <BackTitle onBack={() => setPicking(false)}>Choose a task</BackTitle>
          ) : (
            'Place a task'
          )
        }
      >
        <TaskPicker
          date={value.date}
          onPick={(t) => {
            setDraft((d) => ({ ...d, taskId: t.id }))
            setPicking(false)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      onClose={onClose}
      title={isNew ? 'Place a task' : 'Placement'}
      footer={
        isNew ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-fg-faint">{ready ? '' : 'Pick a block, or set a time.'}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" form="placement-form" disabled={!ready}>
                Add
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-faint">{formatDay(value.date, today)}</span>
            <Button
              variant="danger"
              onClick={() => {
                removePlacement(placementId)
                onClose()
              }}
            >
              Remove
            </Button>
          </div>
        )
      }
    >
      <form
        id="placement-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-5"
      >
        <Field label="Task">
          {/* An existing placement keeps its task; a different task is a new placement (TB-14). */}
          <TaskLine task={task} onChange={isNew ? () => setPicking(true) : undefined} />
        </Field>

        <Field label={`Day · ${formatDay(value.date, today)}`}>
          <DayChips value={weekdayOf(value.date)} onChange={setDay} />
        </Field>

        <Field label="Time">
          {timed ? (
            <div className="flex flex-col gap-2">
              <TimeRange start={value.start!} end={value.end!} onChange={(span) => set(span)} />
              {/* Only a placement inside a block can do without a time (D3). */}
              {value.blockId !== undefined && (
                <ChipButton onClick={clearTime} className="min-h-11 self-start">
                  No time · sometime during {block?.name ?? 'the block'}
                </ChipButton>
              )}
            </div>
          ) : (
            <ChipButton onClick={() => set(defaultSpan(block))} className="min-h-11 self-start">
              Set a time…
            </ChipButton>
          )}
        </Field>

        <Field label="In block">
          {dayBlocks.length === 0 ? (
            <span className="text-sm text-fg-faint">No blocks on this day.</span>
          ) : (
            <div role="radiogroup" aria-label="In block" className="flex flex-wrap gap-1.5">
              <ChipButton
                role="radio"
                aria-checked={value.blockId === undefined}
                active={value.blockId === undefined}
                // Leaving the block with no time would leave nothing to draw (D3).
                disabled={!timed}
                title={timed ? undefined : 'Set a time first'}
                onClick={() => setBlock(undefined)}
                className="min-h-11"
              >
                None
              </ChipButton>
              {dayBlocks.map((b) => (
                <ChipButton
                  key={b.id}
                  role="radio"
                  aria-checked={b.id === value.blockId}
                  active={b.id === value.blockId}
                  onClick={() => setBlock(b)}
                  className="inline-flex min-h-11 items-center gap-2"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.colour }} />
                  {b.name}
                  <span className="text-xs opacity-70">{describeSpan(b.start, b.end)}</span>
                </ChipButton>
              ))}
            </div>
          )}
        </Field>
      </form>
    </Sheet>
  )
}

/** The chosen task as one line (Space dot, title), tappable to change it while drafting. */
function TaskLine({ task, onChange }: { task?: Task; onChange?: () => void }) {
  const space = useSpaces((s) => (task ? s.spaces.find((sp) => sp.id === task.spaceId) : undefined))
  const body = task ? (
    <>
      <SpaceDot colour={space?.colour ?? '#d4d4d4'} title={space?.name} />
      <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug">{task.title}</span>
    </>
  ) : (
    <span className="flex-1 text-fg-faint">Choose a task…</span>
  )
  if (!onChange) return <div className="flex min-h-11 items-center gap-2.5 rounded-xl bg-surface-2 px-3">{body}</div>
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3 text-left hover:bg-surface-2"
    >
      {body}
      {task && <span className="text-xs text-fg-muted">Change</span>}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

// ---- Shared form pieces --------------------------------------------------------
// Used by this sheet and BlockSheet (§5.3). Phone-first: every control is 44px tall.

/** Sheet title that steps back to the form instead of closing. */
export function BackTitle({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-semibold hover:bg-surface-2"
    >
      <ChevronLeftIcon size={20} />
      {children}
    </button>
  )
}

/** Mon…Sun as one row of seven equal radio chips — no padding, so the row fits a phone. */
export function DayChips({ value, onChange }: { value: Weekday; onChange: (weekday: Weekday) => void }) {
  return (
    <div role="radiogroup" aria-label="Day" className="flex gap-1">
      {WEEKDAYS_MONDAY_FIRST.map((d) => {
        const on = d === value
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d)}
            className={`min-h-11 min-w-0 flex-1 rounded-lg border text-sm font-medium transition-colors ${
              on ? 'border-fg bg-fg text-bg' : 'border-line-strong text-fg-muted hover:bg-surface-2'
            }`}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        )
      })}
    </div>
  )
}

/** 00:00 … 24:00 at 15-minute steps (D5). */
const TIMES: Minutes[] = Array.from({ length: DAY / STEP + 1 }, (_, i) => i * STEP)

/**
 * Start and end as two native selects (the platform's own picker on a phone). End
 * options are only those after start; moving start past end keeps the duration.
 */
export function TimeRange({
  start,
  end,
  onChange,
}: {
  start: Minutes
  end: Minutes
  onChange: (span: { start: Minutes; end: Minutes }) => void
}) {
  const setStart = (next: Minutes) => {
    const nextEnd = end > next ? end : Math.min(next + (end - start), DAY)
    onChange({ start: next, end: nextEnd })
  }
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Start" value={start} onChange={(e) => setStart(Number(e.target.value))} className={`${field} tabular-nums`}>
        {TIMES.filter((t) => t < DAY).map((t) => (
          <option key={t} value={t}>
            {describeMinutes(t)}
          </option>
        ))}
      </select>
      <span className="text-fg-faint" aria-hidden>
        –
      </span>
      <select aria-label="End" value={end} onChange={(e) => onChange({ start, end: Number(e.target.value) })} className={`${field} tabular-nums`}>
        {TIMES.filter((t) => t > start).map((t) => (
          <option key={t} value={t}>
            {describeMinutes(t)}
          </option>
        ))}
      </select>
    </div>
  )
}
