import { useState } from 'react'
import { format } from 'date-fns'
import { useRoutines } from '../store/routines'
import { Sheet } from './Sheet'
import { Button, IconButton, SectionLabel, field } from './ui'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { monthGrid, shiftMonth, toISODate } from '../lib/dates'
import { useToday } from '../lib/useToday'
import {
  isMissed,
  isScheduledOn,
  WEEKDAYS_MONDAY_FIRST,
  WEEKDAY_SHORT,
  type NewRoutine,
  type Routine,
  type RoutinePatch,
  type Schedule,
  type Weekday,
} from '../domain/routine'

interface Props {
  /** `null` creates a new Routine; the form is a local draft until "Add". */
  routineId: string | null
  onClose: () => void
}


const EMPTY_DRAFT: NewRoutine = { title: '', schedule: { kind: 'daily' }, note: '' }

/**
 * Edit form for one Routine. Existing routines save every change immediately, like
 * TaskEditor; a new one is a draft with an Add button, like QuickAdd.
 */
export function RoutineEditor({ routineId, onClose }: Props) {
  const routine = useRoutines((s) => (routineId ? s.routines.find((r) => r.id === routineId) : undefined))
  const add = useRoutines((s) => s.add)
  const update = useRoutines((s) => s.update)
  const archive = useRoutines((s) => s.archive)
  const checkIn = useRoutines((s) => s.checkIn)
  const uncheck = useRoutines((s) => s.uncheck)
  const today = useToday()
  const [draft, setDraft] = useState<NewRoutine>(EMPTY_DRAFT)

  const isNew = routineId === null
  if (!isNew && !routine) return null

  const value: Pick<Routine, 'title' | 'schedule' | 'note'> = isNew
    ? { title: draft.title, schedule: draft.schedule ?? { kind: 'daily' }, note: draft.note ?? '' }
    : routine!
  const set = (patch: RoutinePatch) =>
    isNew ? setDraft((d) => ({ ...d, ...patch })) : update(routineId, patch)

  const submit = () => {
    if (!draft.title.trim()) return
    add(draft)
    onClose()
  }

  return (
    <Sheet
      onClose={onClose}
      title={isNew ? 'New routine' : 'Routine'}
      footer={
        isNew ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="routine-form" disabled={!draft.title.trim()}>
              Add
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-faint">
              {routine!.checkIns.length} check-in{routine!.checkIns.length === 1 ? '' : 's'} · since{' '}
              {routine!.createdAt.slice(0, 10)}
            </span>
            {/* Permanent delete lives only on the Archive page (Q28). */}
            <Button
              variant="ghost"
              onClick={() => {
                archive(routineId)
                onClose()
              }}
            >
              Archive
            </Button>
          </div>
        )
      }
    >
      <form
        id="routine-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (isNew) submit()
        }}
        className="flex flex-col gap-5"
      >
        <input
          autoFocus={isNew}
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Read 20 pages"
          aria-label="Title"
          className={isNew ? `${field} min-h-12 text-lg` : 'w-full bg-transparent text-xl font-semibold outline-none placeholder:text-fg-faint'}
        />

        <ScheduleField value={value.schedule} onChange={(schedule) => set({ schedule })} />

        <label className="flex flex-col gap-2">
          <SectionLabel>Note</SectionLabel>
          <input
            value={value.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="currently: Peak"
            className={field}
          />
        </label>

        {/* PD-14: how the Routine has been going, drawn not scored. */}
        {!isNew && <HistoryGrid routine={routine!} onToggleToday={(done) => (done ? checkIn : uncheck)(routineId, today)} />}
      </form>
    </Sheet>
  )
}

/** Starting set when switching from "Every day" to chosen weekdays. */
const WORKDAYS: Weekday[] = [1, 2, 3, 4, 5]

function ScheduleField({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const daily = value.kind === 'daily'
  const days = value.kind === 'weekdays' ? value.days : []

  const toggleDay = (d: Weekday) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    onChange({ kind: 'weekdays', days: WEEKDAYS_MONDAY_FIRST.filter((x) => next.includes(x)) })
  }

  const segment = (active: boolean) =>
    `min-h-9 flex-1 rounded-lg px-3 text-sm ${active ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-2'}`

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Schedule</SectionLabel>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        <button type="button" onClick={() => onChange({ kind: 'daily' })} className={segment(daily)}>
          Every day
        </button>
        <button
          type="button"
          onClick={() => daily && onChange({ kind: 'weekdays', days: WORKDAYS })}
          className={segment(!daily)}
        >
          Chosen days
        </button>
      </div>
      {!daily && (
        <div className="flex gap-1">
          {WEEKDAYS_MONDAY_FIRST.map((d) => {
            const on = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                className={`min-h-10 flex-1 rounded-lg border text-xs font-medium ${
                  on ? 'border-fg bg-fg text-bg' : 'border-line-strong text-fg-muted hover:bg-surface-2'
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            )
          })}
        </div>
      )}
      {!daily && days.length === 0 && <span className="text-xs text-fg-faint">Never scheduled — pick at least one day.</span>}
    </div>
  )
}

/**
 * PD-14: a month of the Routine, Monday-first: each day checked, missed, not
 * scheduled, or not yet. Read-only except today (Q22), which toggles its Check-in.
 */
function HistoryGrid({ routine, onToggleToday }: { routine: Routine; onToggleToday: (done: boolean) => void }) {
  const today = useToday()
  const [month, setMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T12:00:00`))
  const days = monthGrid(month)
  const todayDate = new Date(`${today}T12:00:00`)
  const first = routine.createdAt.slice(0, 10)

  const cell = (date: Date) => {
    const iso = toISODate(date)
    const inMonth = date.getMonth() === month.getMonth()
    const done = routine.checkIns.includes(iso)
    const isToday = iso === today
    const future = iso > today
    const before = iso < first && !done
    const missed = !before && isMissed(routine, date, todayDate)
    const scheduled = isScheduledOn(routine.schedule, date)
    const tone = done
      ? 'bg-success text-white'
      : missed
        ? 'border border-danger/60 text-danger'
        : isToday && scheduled
          ? 'border border-fg text-fg'
          : scheduled && !future && !before
            ? 'bg-surface-2 text-fg-muted'
            : 'text-fg-faint'
    const label = `${format(date, 'EEE d MMM')}: ${done ? 'done' : missed ? 'missed' : isToday ? 'today' : scheduled ? (future ? 'not yet' : 'no check-in') : 'not scheduled'}`
    const body = (
      <span className={`grid h-8 w-8 place-items-center rounded-full text-xs tabular-nums ${tone} ${inMonth ? '' : 'opacity-30'}`}>
        {date.getDate()}
      </span>
    )
    return (
      <li key={iso} className="grid place-items-center" title={label}>
        {isToday ? (
          <button type="button" onClick={() => onToggleToday(!done)} aria-label={`${label}. ${done ? 'Uncheck' : 'Check in'}`} aria-pressed={done}>
            {body}
          </button>
        ) : (
          <span aria-label={label}>{body}</span>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionLabel>History</SectionLabel>
        <span className="flex items-center gap-1">
          <IconButton label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-8 w-8">
            <ChevronLeftIcon size={16} />
          </IconButton>
          <span className="w-24 text-center text-xs text-fg-muted">{format(month, 'MMM yyyy')}</span>
          <IconButton label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="h-8 w-8">
            <ChevronRightIcon size={16} />
          </IconButton>
        </span>
      </div>
      <ul aria-hidden className="grid grid-cols-7 text-center text-[10px] text-fg-faint">
        {WEEKDAYS_MONDAY_FIRST.map((d) => (
          <li key={d}>{WEEKDAY_SHORT[d][0]}</li>
        ))}
      </ul>
      <ul aria-label="History" className="grid grid-cols-7 gap-y-1">
        {days.map(cell)}
      </ul>
    </div>
  )
}
