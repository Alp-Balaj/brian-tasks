import { useState } from 'react'
import { format } from 'date-fns'
import { useBlocks } from '../store/blocks'
import { useRoutines } from '../store/routines'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { Sheet } from './Sheet'
import { TaskPicker } from './TaskPicker'
import { BackTitle, DayChips, TimeRange } from './PlacementSheet'
import { Switch } from './TaskEditor'
import { TaskRow } from './TaskRow'
import { SpaceDot } from './TaskCard'
import { CloseIcon, PlusIcon } from './icons'
import { Button, Chip, ChipButton, CircleCheck, IconButton, SectionLabel, field } from './ui'
import { formatDay } from '../lib/dates'
import { useToday } from '../lib/useToday'
import type { ISODate, Task } from '../domain/task'
import { WEEKDAY_SHORT, hasCheckIn, type Routine } from '../domain/routine'
import {
  BLOCK_COLOURS,
  blockNames,
  carries,
  dateInWeek,
  describeSpan,
  isStalePlacement,
  isTimed,
  nextFreeBlockColour,
  placementsIn,
  weekOf,
  weekdayOf,
  type Block,
  type BlockPatch,
  type NewBlock,
  type Placement,
} from '../domain/block'

interface Props {
  /** `null` creates a new block; the form is a local draft until "Add". */
  blockId: string | null
  /** The day the sheet was opened from; its week is where edits apply from (TB-5). */
  date: ISODate
  preset?: Partial<NewBlock>
  onClose: () => void
}

/** What the form edits: the same five fields whether it is a draft or a stored block. */
type Fields = Pick<Block, 'name' | 'colour' | 'weekday' | 'start' | 'end'>

/** The sheet's own pages: the form, or one of the two pickers in its place. */
type Page = 'form' | 'task' | 'routine'

/**
 * One block's sheet (TB-10, §5.3). An existing block saves every change immediately
 * through `updateBlockFrom(id, week, patch)`, so TB-5 is automatic: the store splits
 * a standing block at this week and the sheet follows the version the edit landed on.
 * There is deliberately no "this / future / all" question. A new block is a draft
 * until "Add", like RoutineEditor; its Routines and Tasks are linked once it exists.
 */
export function BlockSheet({ blockId, date, preset, onClose }: Props) {
  const week = weekOf(date)
  const today = useToday()
  // The id the sheet is on. The first edit in a later week splits the rule (D8) and
  // hands back a fresh id for the future version; every edit after that lands there.
  const [id, setId] = useState(blockId)
  const block = useBlocks((s) => (id ? s.blocks.find((b) => b.id === id) : undefined))
  const blocks = useBlocks((s) => s.blocks)
  const placements = useBlocks((s) => s.placements)
  const addBlock = useBlocks((s) => s.addBlock)
  const updateBlockFrom = useBlocks((s) => s.updateBlockFrom)
  const setCarry = useBlocks((s) => s.setCarry)
  const endBlock = useBlocks((s) => s.endBlock)
  const removeBlock = useBlocks((s) => s.removeBlock)
  const addPlacement = useBlocks((s) => s.addPlacement)
  const routines = useRoutines((s) => s.routines)

  const [draft, setDraft] = useState<NewBlock>(() => ({
    name: '',
    colour: nextFreeBlockColour(blocks),
    weekday: weekdayOf(date),
    start: 540,
    end: 600,
    week,
    carry: false, // TB-4: one-off by default
    ...preset,
  }))
  const [page, setPage] = useState<Page>('form')

  const isNew = blockId === null
  if (!isNew && !block) return null

  const value: Fields = isNew ? draft : block!
  const carry = isNew ? draft.carry === true : carries(block!)
  // The day this block falls on in the sheet's week — `date` no longer is once the weekday chip moves it.
  const day = dateInWeek(week, value.weekday)
  const names = blockNames(blocks)

  const follow = (landed: string | undefined) => {
    if (landed !== undefined && landed !== id) setId(landed)
  }
  const set = (patch: BlockPatch) => {
    if (isNew) setDraft((d) => ({ ...d, ...patch }))
    else follow(updateBlockFrom(id!, week, patch))
  }
  const setCarryOn = (on: boolean) => {
    if (isNew) setDraft((d) => ({ ...d, carry: on }))
    else follow(setCarry(id!, week, on))
  }

  const canAdd = draft.name.trim() !== '' && draft.start < draft.end
  const submit = () => {
    if (!canAdd) return
    addBlock({ ...draft, week })
    onClose()
  }

  // Footer per §2: a version that starts this week can be deleted outright; an older
  // standing one only ends here, so past weeks keep what they had (TB-1).
  const startsThisWeek = !isNew && block!.from >= week
  const remove = () => {
    const what = startsThisWeek ? `Delete "${block!.name}"?` : `Remove "${block!.name}" from this week on? Earlier weeks keep it.`
    if (!confirm(what)) return
    if (startsThisWeek) removeBlock(id!)
    else endBlock(id!, week)
    onClose()
  }

  if (page === 'task' && block) {
    const linked = placementsIn(placements, block, day).map((p) => p.taskId)
    return (
      <Sheet onClose={() => setPage('form')} title={<BackTitle onBack={() => setPage('form')}>Add task</BackTitle>}>
        <TaskPicker
          date={day}
          excludeIds={linked}
          onPick={(task) => {
            // TB-8: no hour by default — "sometime during this block". Scheduled follows in the store (TB-15).
            addPlacement({ taskId: task.id, date: day, blockId: block.id })
            setPage('form')
          }}
        />
      </Sheet>
    )
  }

  if (page === 'routine' && block) {
    return (
      <Sheet onClose={() => setPage('form')} title={<BackTitle onBack={() => setPage('form')}>Add routine</BackTitle>}>
        <RoutinePicker
          routines={routines.filter((r) => !r.archived && !block.routineIds.includes(r.id))}
          onPick={(r) => {
            set({ routineIds: [...block.routineIds, r.id] })
            setPage('form')
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      onClose={onClose}
      title={isNew ? 'New block' : 'Block'}
      footer={
        isNew ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="block-form" disabled={!canAdd}>
              Add
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-fg-faint">
              {WEEKDAY_SHORT[value.weekday]} · {describeSpan(value.start, value.end)}
            </span>
            <Button variant="danger" onClick={remove}>
              {startsThisWeek ? 'Delete' : 'Remove from this week on'}
            </Button>
          </div>
        )
      }
    >
      <form
        id="block-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (isNew) submit()
        }}
        className="flex flex-col gap-5"
      >
        <NameField
          value={value.name}
          names={names}
          isNew={isNew}
          onChange={(name, colour) => set(colour ? { name, colour } : { name })}
        />

        <Field label="Colour">
          <ColourSwatches value={value.colour} onChange={(colour) => set({ colour })} />
        </Field>

        <Field label="Day">
          <DayChips value={value.weekday} onChange={(weekday) => set({ weekday })} />
        </Field>

        <Field label="Time">
          <TimeRange start={value.start} end={value.end} onChange={(span) => set(span)} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3">
            <span className="text-sm">Carry to next week</span>
            <Switch checked={carry} onChange={() => setCarryOn(!carry)} label="Carry to next week" />
          </label>
          {!isNew && carry && block!.from < week && (
            <span className="px-1 text-xs text-fg-faint">Standing since {format(new Date(`${block!.from}T12:00:00`), 'd MMM yyyy')}</span>
          )}
        </div>

        {isNew ? (
          <p className="text-xs text-fg-faint">Routines and tasks can be linked once the block is added.</p>
        ) : (
          <>
            <RoutinesSection block={block!} day={day} today={today} onUnlink={(rid) => set({ routineIds: block!.routineIds.filter((x) => x !== rid) })} onAdd={() => setPage('routine')} />
            <TasksSection block={block!} day={day} today={today} onAdd={() => setPage('task')} />
          </>
        )}
      </form>
    </Sheet>
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

/**
 * Name with autocomplete over the existing names; a known name brings its colour along
 * (TB-3). A local draft keeps what is typed (the store trims on save, and an empty
 * name is never saved); blur snaps back to the stored value.
 */
function NameField({
  value,
  names,
  isNew,
  onChange,
}: {
  value: string
  names: { name: string; colour: string }[]
  isNew: boolean
  onChange: (name: string, colour?: string) => void
}) {
  const [text, setText] = useState(value)
  return (
    <>
      <input
        list="block-names"
        autoFocus={isNew}
        value={text}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          if (!isNew && next.trim() === '') return
          onChange(next, names.find((n) => n.name === next.trim())?.colour)
        }}
        onBlur={() => !isNew && setText(value)}
        placeholder="Job, Gym, Sleep…"
        aria-label="Name"
        autoComplete="off"
        className={isNew ? `${field} min-h-12 text-lg` : 'w-full min-h-11 bg-transparent text-xl font-semibold outline-none placeholder:text-fg-faint'}
      />
      <datalist id="block-names">
        {names.map((n) => (
          <option key={n.name} value={n.name} />
        ))}
      </datalist>
    </>
  )
}

/** The 12 palette colours (D11) as a radiogroup; each swatch sits in a 44px cell. */
function ColourSwatches({ value, onChange }: { value: string; onChange: (colour: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="grid grid-cols-6 gap-1">
      {BLOCK_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={c}
          onClick={() => onChange(c)}
          className="grid h-11 w-full place-items-center rounded-xl hover:bg-surface-2"
        >
          <span
            className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-surface ${c === value ? 'ring-2 ring-fg' : ''}`}
            style={{ backgroundColor: c }}
          />
        </button>
      ))}
    </div>
  )
}

/**
 * Linked Routines (TB-8). The check is today's Check-in and only today's can be made
 * here (Q22); on any other day it shows that day's record, read-only (TB-1).
 */
function RoutinesSection({
  block,
  day,
  today,
  onUnlink,
  onAdd,
}: {
  block: Block
  day: ISODate
  today: ISODate
  onUnlink: (routineId: string) => void
  onAdd: () => void
}) {
  const routines = useRoutines((s) => s.routines)
  const checkIn = useRoutines((s) => s.checkIn)
  const uncheck = useRoutines((s) => s.uncheck)
  const linked = block.routineIds.map((rid) => routines.find((r) => r.id === rid)).filter((r): r is Routine => r !== undefined)
  const isToday = day === today

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Routines</SectionLabel>
        <AddLink onClick={onAdd}>routine</AddLink>
      </div>
      {linked.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2/60">
          {linked.map((r) => {
            const done = hasCheckIn(r, day)
            return (
              <li key={r.id} className="flex min-h-12 items-center gap-1 pr-1 pl-1">
                <span inert={!isToday} title={isToday ? undefined : 'Check in on the day'} className={isToday ? '' : 'opacity-40'}>
                  <CircleCheck
                    checked={done}
                    onChange={(next) => (next ? checkIn(r.id, today) : uncheck(r.id, today))}
                    label={`${r.title} done today`}
                    tone="success"
                  />
                </span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${done ? 'text-fg-faint' : ''}`}>{r.title}</span>
                <IconButton label={`Unlink ${r.title}`} onClick={() => onUnlink(r.id)}>
                  <CloseIcon size={16} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      {linked.length > 0 && !isToday && <span className="px-1 text-xs text-fg-faint">Check in on the day.</span>}
    </section>
  )
}

/** Live routines not yet on the block, one tap each. */
function RoutinePicker({ routines, onPick }: { routines: Routine[]; onPick: (r: Routine) => void }) {
  if (routines.length === 0) return <p className="text-sm text-fg-faint">Every routine is already linked, or there are none yet.</p>
  return (
    <ul role="listbox" aria-label="Routines" className="flex flex-col">
      {routines.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onPick(r)}
            className="flex min-h-12 w-full flex-col justify-center rounded-xl px-3 text-left hover:bg-surface-2"
          >
            <span className="text-[15px]">{r.title}</span>
            {r.note && <span className="truncate text-xs text-fg-muted">{r.note}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Linked Tasks: this block's placements on `day` (TB-8, TB-9 — per date, so they never
 * carry). Done inline; done ones dim (TB-16). The "at…" chip gives a placement an
 * hour, which draws it on the grid (TB-11).
 */
function TasksSection({ block, day, today, onAdd }: { block: Block; day: ISODate; today: ISODate; onAdd: () => void }) {
  const placements = useBlocks((s) => s.placements)
  const updatePlacement = useBlocks((s) => s.updatePlacement)
  const removePlacement = useBlocks((s) => s.removePlacement)
  const tasks = useTasks((s) => s.tasks)
  const update = useTasks((s) => s.update)
  const [timing, setTiming] = useState<string | null>(null)

  const rows = placementsIn(placements, block, day)
    .map((p) => ({ p, task: tasks.find((t) => t.id === p.taskId) }))
    .filter((r): r is { p: Placement; task: Task } => r.task !== undefined)

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Tasks</SectionLabel>
        <AddLink onClick={onAdd}>task</AddLink>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2/60">
          {rows.map(({ p, task }) => {
            const open = timing === p.id
            const timed = isTimed(p)
            return (
              <PlacementRow
                key={p.id}
                placement={p}
                task={task}
                today={today}
                open={open}
                onToggle={() => setTiming(open ? null : p.id)}
                onDone={(done) => update(task.id, { status: done ? 'done' : 'todo' })}
                onTime={(span) => updatePlacement(p.id, span)}
                onClearTime={() => {
                  updatePlacement(p.id, { start: undefined, end: undefined })
                  setTiming(null)
                }}
                onRemove={() => removePlacement(p.id)}
                defaultSpan={{ start: block.start, end: Math.min(block.start + 60, block.end) }}
                timed={timed}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PlacementRow({
  placement,
  task,
  today,
  open,
  timed,
  defaultSpan,
  onToggle,
  onDone,
  onTime,
  onClearTime,
  onRemove,
}: {
  placement: Placement
  task: Task
  today: ISODate
  open: boolean
  timed: boolean
  defaultSpan: { start: number; end: number }
  onToggle: () => void
  onDone: (done: boolean) => void
  onTime: (span: { start: number; end: number }) => void
  onClearTime: () => void
  onRemove: () => void
}) {
  const space = useSpaces((s) => s.spaces.find((sp) => sp.id === task.spaceId))
  const placements = useBlocks((s) => s.placements)
  const stale = isStalePlacement(placement, task, placements)
  return (
    <>
      <TaskRow
        task={task}
        onOpen={onToggle}
        onToggleDone={onDone}
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <SpaceDot colour={space?.colour ?? '#d4d4d4'} />
              {space?.name ?? 'Unknown space'}
            </span>
            {/* TB-17: re-Scheduled from the editor to a day it is not placed on. */}
            {stale && task.scheduled && <Chip tone="warn">Scheduled {formatDay(task.scheduled, today)}</Chip>}
          </>
        }
        trailing={
          <>
            <ChipButton active={open} onClick={onToggle} className="min-h-11 shrink-0 tabular-nums" title="Time within the block">
              {timed ? describeSpan(placement.start!, placement.end!) : 'at…'}
            </ChipButton>
            <IconButton label={`Remove ${task.title} from this block`} onClick={onRemove}>
              <CloseIcon size={16} />
            </IconButton>
          </>
        }
      />
      {open && (
        <li className="flex flex-col gap-2 px-3 py-2">
          <TimeRange
            start={timed ? placement.start! : defaultSpan.start}
            end={timed ? placement.end! : defaultSpan.end}
            onChange={onTime}
          />
          <div className="flex justify-between gap-2">
            {timed ? (
              <Button variant="ghost" onClick={onClearTime} className="min-h-11">
                Clear time
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => onTime(defaultSpan)} className="min-h-11">
                Set {describeSpan(defaultSpan.start, defaultSpan.end)}
              </Button>
            )}
            <Button variant="ghost" onClick={onToggle} className="min-h-11">
              Done
            </Button>
          </div>
        </li>
      )}
    </>
  )
}

/** The small "+ task" / "+ routine" affordance, styled like Home's "+ routine". */
function AddLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
    >
      <PlusIcon size={14} />
      {children}
    </button>
  )
}
