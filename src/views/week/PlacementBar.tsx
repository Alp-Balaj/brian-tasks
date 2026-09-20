import type { Task } from '../../domain/task'
import { describeSpan, type Minutes, type Placement } from '../../domain/block'
import { spanStyle } from './layout'
import type { BarDrag } from './useRulerDrag'

interface Props {
  placement: Placement & { start: Minutes; end: Minutes }
  task: Task
  /** The task's Space colour, drawn as the outline. */
  colour: string
  /** TB-17: the task was re-Scheduled to a day it is not placed on. */
  stale?: boolean
  /** Home's strip never writes the title inside the bar (TB-21). */
  badgeOnly?: boolean
  onOpen: () => void
  /** Desktop only (TB-22): the body moves, the edges resize. Absent on a phone. */
  drag?: BarDrag
}

/**
 * One timed placement: a small bar in the bottom 45% of the row, drawn over the
 * blocks, outlined in the task's Space colour. A done or archived task keeps its
 * placement, dimmed and struck through (TB-16); a stale one gets a dashed outline
 * and a warn dot (TB-17). The title is written inside when the bar is wide enough.
 */
export function PlacementBar({ placement, task, colour, stale = false, badgeOnly = false, onOpen, drag }: Props) {
  const done = task.status === 'done' || task.archived
  const span = describeSpan(placement.start, placement.end)
  const hint = done ? 'done' : stale ? 'Scheduled elsewhere, not placed there' : undefined
  const label = `${task.title} · ${span}${hint ? ` · ${hint}` : ''}`
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={drag?.onPointerDown}
      title={label}
      aria-label={label}
      className={`@container absolute top-[52%] bottom-[3%] z-30 overflow-hidden rounded-sm text-left text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        done ? 'opacity-60' : 'hover:brightness-110'
      }`}
      style={{
        ...spanStyle(placement.start, placement.end),
        // A surface tinted with the Space colour, so the bar reads on a block in either theme.
        backgroundColor: `color-mix(in srgb, ${colour} 22%, var(--surface))`,
        border: `1.5px ${stale && !done ? 'dashed' : 'solid'} ${colour}`,
      }}
    >
      {!badgeOnly && (
        <span className="absolute inset-0 hidden items-center gap-1 px-1 @min-[56px]:flex">
          {stale && !done && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />}
          <span className={`truncate text-[10px] leading-3 ${done ? 'text-fg-faint line-through' : ''}`}>{task.title}</span>
        </span>
      )}
      {/* 6px resize handles (§5.8); a bar too narrow for both is move-only. */}
      {drag && (
        <>
          <span
            aria-hidden
            onPointerDown={(e) => drag.onHandlePointerDown('start', e)}
            className="absolute inset-y-0 left-0 hidden w-1.5 cursor-ew-resize @min-[24px]:block"
          />
          <span
            aria-hidden
            onPointerDown={(e) => drag.onHandlePointerDown('end', e)}
            className="absolute inset-y-0 right-0 hidden w-1.5 cursor-ew-resize @min-[24px]:block"
          />
        </>
      )}
    </button>
  )
}
