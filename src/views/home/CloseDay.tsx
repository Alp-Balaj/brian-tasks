import { useMemo, useState } from 'react'
import type { ISODate, Task } from '../../domain/task'
import { CLOSE_DAY_FROM_HOUR, openRows, type OpenReason } from '../../domain/home'
import { placementsOn } from '../../domain/block'
import { useTasks } from '../../store/tasks'
import { useBlocks } from '../../store/blocks'
import { useNow } from '../../lib/useNow'
import { RowGroup } from '../../components/TaskRow'
import { ChipButton, SectionLabel } from '../../components/ui'
import { LaterMenu } from '../../components/LaterMenu'
import { HomeTaskRow } from './HomeTaskRow'

/** The date Later moves for an open row (PD-9): Due when that is why it is here, else Scheduled. */
const fieldFor = (reason: OpenReason): 'due' | 'scheduled' => (reason === 'due' ? 'due' : 'scheduled')

/**
 * PD-9: from 18:00, Home ends with what is still open on today — due, overdue,
 * Scheduled today or placed today and not done — each settled as done (the check),
 * tomorrow, or Later. When nothing is left the day is closed until midnight. Nothing
 * is recorded; a day that is not closed is simply tomorrow's Overdue.
 */
export function CloseDay({ today, onOpen }: { today: ISODate; onOpen: (id: string) => void }) {
  const tasks = useTasks((s) => s.tasks)
  const update = useTasks((s) => s.update)
  const later = useTasks((s) => s.later)
  const placements = useBlocks((s) => s.placements)
  const now = useNow()
  const [menu, setMenu] = useState<{ task: Task; field: 'due' | 'scheduled' } | null>(null)

  const rows = useMemo(() => {
    const placedToday = new Set(placementsOn(placements, today).map((p) => p.taskId))
    return openRows(tasks, placedToday, today)
  }, [tasks, placements, today])

  const evening = now >= CLOSE_DAY_FROM_HOUR * 60
  if (!evening) return null

  return (
    <section className="flex flex-col gap-1.5" aria-label="Close the day">
      <SectionLabel className="flex items-baseline gap-2 px-1">
        Close the day
        {rows.length > 0 && <span className="font-normal text-fg-faint">{rows.length}</span>}
      </SectionLabel>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-5 text-center text-sm text-fg-faint">Day closed. See you tomorrow.</p>
      ) : (
        <RowGroup>
          {rows.map(({ task, reason }) => (
            <HomeTaskRow
              key={task.id}
              task={task}
              reason={reason === 'due' ? undefined : 'scheduled'}
              onOpen={() => onOpen(task.id)}
              onToggleDone={(done) => update(task.id, { status: done ? 'done' : 'todo' })}
              trailing={
                <span className="flex shrink-0 items-center gap-1">
                  <ChipButton onClick={() => later(task.id, 'tomorrow', fieldFor(reason))} className="min-h-8 px-2.5 text-xs" title="Move to tomorrow">
                    Tomorrow
                  </ChipButton>
                  <ChipButton onClick={() => setMenu({ task, field: fieldFor(reason) })} className="min-h-8 px-2.5 text-xs">
                    Later
                  </ChipButton>
                </span>
              }
            />
          ))}
        </RowGroup>
      )}
      {menu && <LaterMenu taskId={menu.task.id} field={menu.field} onClose={() => setMenu(null)} />}
    </section>
  )
}
