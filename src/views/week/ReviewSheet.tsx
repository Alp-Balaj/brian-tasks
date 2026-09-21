import { useMemo } from 'react'
import type { WeekKey } from '../../domain/block'
import { describeMinutes, isTimed } from '../../domain/block'
import { describeReview, weekReview } from '../../domain/review'
import { useTasks } from '../../store/tasks'
import { useRoutines } from '../../store/routines'
import { useBlocks } from '../../store/blocks'
import { useSpaces } from '../../store/spaces'
import { useToday } from '../../lib/useToday'
import { formatDay } from '../../lib/dates'
import { Sheet } from '../../components/Sheet'
import { RowGroup } from '../../components/TaskRow'
import { IconButton, SectionLabel } from '../../components/ui'
import { SpaceDot } from '../../components/TaskCard'
import { CloseIcon } from '../../components/icons'

/**
 * PD-12: the look-back behind the Week header's line. Tasks finished that week by
 * Space, each Routine's Check-ins over its scheduled days so far, and the stale
 * Placements — past days whose Task is still open — one tap to remove each. Drawn,
 * not scored.
 */
export function ReviewSheet({ week, onClose, onOpenTask }: { week: WeekKey; onClose: () => void; onOpenTask: (id: string) => void }) {
  const tasks = useTasks((s) => s.tasks)
  const routines = useRoutines((s) => s.routines)
  const blocks = useBlocks((s) => s.blocks)
  const placements = useBlocks((s) => s.placements)
  const removePlacement = useBlocks((s) => s.removePlacement)
  const spaces = useSpaces((s) => s.spaces)
  const today = useToday()

  const review = useMemo(() => weekReview(tasks, routines, blocks, placements, week, today), [tasks, routines, blocks, placements, week, today])
  const spaceOf = (id: string) => spaces.find((s) => s.id === id)

  return (
    <Sheet onClose={onClose} title="Look back">
      <div className="flex flex-col gap-6">
        <p className="px-1 text-sm text-fg-muted">{describeReview(review)}</p>

        <section className="flex flex-col gap-1.5">
          <SectionLabel className="px-1">Done</SectionLabel>
          {review.done.length === 0 ? (
            <p className="px-1 text-sm text-fg-faint">Nothing finished this week yet.</p>
          ) : (
            review.done.map((group) => {
              const space = spaceOf(group.spaceId)
              return (
                <div key={group.spaceId} className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1.5 px-1 text-xs text-fg-muted">
                    <SpaceDot colour={space?.colour ?? '#d4d4d4'} />
                    {space?.name ?? 'Unknown space'}
                    <span className="text-fg-faint">{group.tasks.length}</span>
                  </span>
                  <RowGroup>
                    {group.tasks.map((t) => (
                      <li key={t.id}>
                        <button onClick={() => onOpenTask(t.id)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-surface-2/60">
                          <span className="line-clamp-1">{t.title}</span>
                          <span className="shrink-0 text-xs text-fg-faint">{formatDay(t.completedAt!.slice(0, 10), today)}</span>
                        </button>
                      </li>
                    ))}
                  </RowGroup>
                </div>
              )
            })
          )}
        </section>

        {review.routines.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel className="px-1">Routines</SectionLabel>
            <RowGroup>
              {review.routines.map(({ routine, checked, scheduled }) => (
                <li key={routine.id} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm">
                  <span className="line-clamp-1">{routine.title}</span>
                  <span className={`shrink-0 tabular-nums ${checked === scheduled ? 'text-success' : 'text-fg-muted'}`}>
                    {checked}/{scheduled}
                  </span>
                </li>
              ))}
            </RowGroup>
          </section>
        )}

        {review.stale.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel className="px-1">Stale</SectionLabel>
            <p className="px-1 text-xs text-fg-faint">Placed on a day that has passed, not done. Remove the mark or keep it as a record.</p>
            <RowGroup>
              {review.stale.map(({ placement, task, block }) => (
                <li key={placement.id} className="flex min-h-11 items-center gap-1 pr-1 pl-3 text-sm">
                  <button onClick={() => onOpenTask(task.id)} className="flex min-w-0 flex-1 flex-col py-1.5 text-left">
                    <span className="line-clamp-1">{task.title}</span>
                    <span className="text-xs text-fg-muted tabular-nums">
                      {formatDay(placement.date, today)}
                      {isTimed(placement) && ` ${describeMinutes(placement.start)}–${describeMinutes(placement.end)}`}
                      {block && ` · in ${block.name}`}
                    </span>
                  </button>
                  <IconButton label={`Remove ${task.title} from ${placement.date}`} onClick={() => removePlacement(placement.id)}>
                    <CloseIcon size={16} />
                  </IconButton>
                </li>
              ))}
            </RowGroup>
          </section>
        )}
      </div>
    </Sheet>
  )
}
