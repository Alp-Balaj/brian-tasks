import { useMemo, useState } from 'react'
import { format, isSameMonth, isToday, startOfMonth } from 'date-fns'
import { onDate } from '../../store/tasks'
import { useVisibleTasks } from '../../store/selectors'
import { monthGrid, shiftMonth, toISODate } from '../../lib/dates'
import { TaskCard } from '../../components/TaskCard'
import { QuickAdd } from '../../components/QuickAdd'
import { useShell } from '../../components/useShell'

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
    <div className="flex h-full flex-col p-3">
      <header className="mb-2 flex items-center justify-between">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded px-2 py-1 hover:bg-neutral-100">
          ‹
        </button>
        <div className="flex items-center gap-3">
          <span className="font-medium">{format(month, 'MMMM yyyy')}</span>
          <button
            onClick={() => {
              setMonth(startOfMonth(new Date()))
              setSelected(toISODate(new Date()))
            }}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100"
          >
            Today
          </button>
        </div>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded px-2 py-1 hover:bg-neutral-100">
          ›
        </button>
      </header>

      <div className="grid grid-cols-7 text-center text-xs text-neutral-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px md:flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
        {days.map((day) => {
          const iso = toISODate(day)
          const dayTasks = onDate(tasks, iso)
          const inMonth = isSameMonth(day, month)
          return (
            <div
              key={iso}
              onClick={() => setSelected(iso)}
              onDoubleClick={() => setAddOn(iso)}
              className={`flex min-h-12 cursor-pointer flex-col gap-0.5 bg-white p-1 md:min-h-24 ${
                inMonth ? '' : 'text-neutral-300'
              } ${selected === iso ? 'bg-neutral-100' : ''}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full ${isToday(day) ? 'bg-neutral-900 text-white' : ''}`}
                >
                  {format(day, 'd')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddOn(iso)
                  }}
                  className="hidden text-neutral-300 hover:text-neutral-900 md:block"
                >
                  +
                </button>
              </div>
              {/* Mobile: dots. Desktop: cards. */}
              <div className="flex gap-0.5 md:hidden">
                {dayTasks.slice(0, 4).map((t) => (
                  <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.status === 'done' ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
                ))}
              </div>
              <div className="hidden flex-col gap-0.5 md:flex">
                {dayTasks.slice(0, 3).map((t) => (
                  <TaskCard key={t.id} task={t} compact onClick={() => openTask(t.id)} />
                ))}
                {dayTasks.length > 3 && <div className="text-xs text-neutral-400">+{dayTasks.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Day agenda (mobile-first; harmless on desktop as a detail strip) */}
      <section className="mt-3 md:hidden">
        <div className="mb-1 flex items-center justify-between text-sm font-medium">
          <span>{format(new Date(selected + 'T00:00'), 'EEEE d MMM')}</span>
          <button onClick={() => setAddOn(selected)} className="text-xs text-neutral-500">
            + add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {selectedTasks.length === 0 && <div className="text-xs text-neutral-400">Nothing on this day.</div>}
          {selectedTasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => openTask(t.id)} />
          ))}
        </div>
      </section>

      {addOn && <QuickAdd defaults={{ due: addOn }} onClose={() => setAddOn(null)} />}
    </div>
  )
}
