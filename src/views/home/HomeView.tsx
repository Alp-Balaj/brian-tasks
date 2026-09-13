import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTasks } from '../../store/tasks'
import { useRoutines } from '../../store/routines'
import { useShell } from '../../components/useShell'
import { toISODate } from '../../lib/dates'
import { RoutinesSection } from './RoutinesSection'
import { HomeTaskRow } from './HomeTaskRow'
import { homeSections } from './homeSections'

/** Today's ISO date, re-checked every minute so an open tab rolls over at midnight (Q11). */
function useToday() {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = toISODate(new Date())
      setToday((prev) => (prev === next ? prev : next))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return today
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex items-baseline gap-2 px-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
        <span className="font-normal text-neutral-400">{count}</span>
      </h2>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">{children}</ul>
    </section>
  )
}

/** Landing page: Routines · Pinned · Today · In progress, across every Space (Q3, Q24). */
export function HomeView() {
  const tasks = useTasks((s) => s.tasks)
  const togglePin = useTasks((s) => s.togglePin)
  const { openTask } = useShell()
  const today = useToday()

  const { pinned, today: todayRows, inProgress } = useMemo(() => homeSections(tasks, today), [tasks, today])

  // S5: RoutinesSection decides its own visibility; we can only approximate "empty"
  // as "no live routines" (it still renders "+ routine" whenever any exist).
  const hasRoutines = useRoutines((s) => s.routines.some((r) => !r.archived))
  const empty = !hasRoutines && pinned.length === 0 && todayRows.length === 0 && inProgress.length === 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-3">
      <h1 className="text-lg font-semibold">Home</h1>

      <RoutinesSection />

      <Section title="Pinned" count={pinned.length}>
        {pinned.map((t) => (
          <HomeTaskRow key={t.id} task={t} onOpen={() => openTask(t.id)} onUnpin={() => togglePin(t.id)} />
        ))}
      </Section>

      <Section title="Today" count={todayRows.length}>
        {todayRows.map(({ task, reason }) => (
          <HomeTaskRow key={task.id} task={task} reason={reason} onOpen={() => openTask(task.id)} />
        ))}
      </Section>

      <Section title="In progress" count={inProgress.length}>
        {inProgress.map((t) => (
          <HomeTaskRow key={t.id} task={t} onOpen={() => openTask(t.id)} />
        ))}
      </Section>

      {empty && <p className="py-10 text-center text-sm text-neutral-400">Nothing needs you right now.</p>}
    </div>
  )
}
