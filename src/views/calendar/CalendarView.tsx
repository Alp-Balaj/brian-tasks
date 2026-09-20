import { useMemo, useState } from 'react'
import { format, isSameMonth, isToday, startOfMonth } from 'date-fns'
import { onDate } from '../../store/tasks'
import { useVisibleTasks } from '../../store/selectors'
import { monthGrid, shiftMonth, toISODate } from '../../lib/dates'
import { TaskCard } from '../../components/TaskCard'
import { QuickAdd } from '../../components/QuickAdd'
import { useShell } from '../../components/useShell'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../components/icons'
import { ChipButton, IconButton } from '../../components/ui'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Month calendar. Tasks appear on their `due` and/or `scheduled` date.
 * Desktop: full grid with cards inside cells. Mobile: grid with dots + a day agenda below.
 */
export function CalendarView() {
  const tasks = useVisibleTasks()
  const { openTask } = useShell()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<string>(toISODate(new Date()))
  const [addOn, setAddOn] = useState<string | null>(null)

  const days = useMemo(() => monthGrid(month), [month])
  const selectedTasks = onDate(tasks, selected)

  return (
    <div className="flex h-full flex-col p-4 pb-24 md:pb-4">
      <header className="mb-2 flex items-center justify-between">
        <IconButton label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeftIcon />
        </IconButton>
        <div className="flex items-center gap-3">
          <span className="font-semibold">{format(month, 'MMMM yyyy')}</span>
          <ChipButton
            onClick={() => {
              setMonth(startOfMonth(new Date()))
              setSelected(toISODate(new Date()))
            }}
            className="min-h-8 px-2.5 text-xs"
          >
            Today
          </ChipButton>
        </div>
        <IconButton label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRightIcon />
        </IconButton>
      </header>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-fg-faint">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line md:flex-1">
        {days.map((day) => {
          const iso = toISODate(day)
          const dayTasks = onDate(tasks, iso)
          const inMonth = isSameMonth(day, month)
          const isSelected = selected === iso
          return (
            <div
              key={iso}
              onClick={() => setSelected(iso)}
              onDoubleClick={() => setAddOn(iso)}
              className={`flex min-h-12 cursor-pointer flex-col gap-1 p-1 md:min-h-24 ${
                isSelected ? 'bg-accent-soft' : 'bg-surface'
              } ${inMonth ? '' : 'text-fg-faint'}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full tabular-nums ${
                    isToday(day) ? 'bg-accent font-semibold text-accent-fg' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddOn(iso)
                  }}
                  aria-label={`Add task on ${iso}`}
                  className="hidden h-6 w-6 place-items-center rounded text-fg-faint hover:bg-surface-2 hover:text-fg md:grid"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
              {/* Mobile: dots. Desktop: cards. */}
              <div className="flex flex-wrap gap-0.5 md:hidden">
                {dayTasks.slice(0, 4).map((t) => (
                  <span
                    key={t.id}
                    className={`h-1.5 w-1.5 rounded-full ${
                      t.status === 'done' ? 'bg-line-strong' : t.due === iso && iso < toISODate(new Date()) ? 'bg-danger' : 'bg-accent'
                    }`}
                  />
                ))}
              </div>
              <div className="hidden flex-col gap-0.5 md:flex">
                {dayTasks.slice(0, 3).map((t) => (
                  <TaskCard key={t.id} task={t} compact onClick={() => openTask(t.id)} />
                ))}
                {dayTasks.length > 3 && <div className="text-xs text-fg-faint">+{dayTasks.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Day agenda (mobile-first; harmless on desktop as a detail strip) */}
      <section className="mt-4 md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{format(new Date(selected + 'T00:00'), 'EEEE d MMM')}</span>
          <ChipButton onClick={() => setAddOn(selected)} className="inline-flex min-h-8 items-center gap-1 px-2.5 text-xs">
            <PlusIcon size={14} />
            Add
          </ChipButton>
        </div>
        <div className="flex flex-col gap-2">
          {selectedTasks.length === 0 && <div className="py-4 text-center text-xs text-fg-faint">Nothing on this day.</div>}
          {selectedTasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />
          ))}
        </div>
      </section>

      {addOn && <QuickAdd defaults={{ due: addOn }} onClose={() => setAddOn(null)} />}
    </div>
  )
}
