import type { Task } from '../../domain/task'
import { describeSpan, type Block } from '../../domain/block'
import { spanStyle } from './layout'
import type { BarDrag } from './useRulerDrag'

interface Props {
  block: Block
  /** The Tasks linked to this block on this day without an hour (TB-8). */
  tasks: readonly Task[]
  /** Home's strip never writes titles inside the bar (TB-21). */
  badgeOnly?: boolean
  onOpen: () => void
  /** Desktop only (TB-22): the body moves, the edges resize. Absent on a phone. */
  drag?: BarDrag
}

/**
 * One block on a day row: a filled bar in the block's colour at 90% opacity with
 * white text. What it shows depends on its own width (container queries, so a bar
 * needs no measuring): the name from 56px, and for linked untimed tasks their
 * titles from 120px, a count badge otherwise (TB-21). Hover shows the full text.
 */
export function BlockBar({ block, tasks, badgeOnly = false, onOpen, drag }: Props) {
  const titles = tasks.map((t) => t.title).join(', ')
  const count = tasks.length
  const label = `${block.name} · ${describeSpan(block.start, block.end)}`
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={drag?.onPointerDown}
      title={count > 0 ? `${label} · ${titles}` : label}
      aria-label={label}
      className="@container absolute inset-y-0 z-10 overflow-hidden rounded-md text-left text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      style={{ ...spanStyle(block.start, block.end), backgroundColor: `${block.colour}e6` }}
    >
      <span className="absolute inset-0 hidden flex-col justify-center px-1.5 @min-[56px]:flex">
        <span className="truncate text-xs leading-4 font-medium">{block.name}</span>
        {count > 0 && !badgeOnly && (
          <span className="hidden truncate text-[10px] leading-3 opacity-85 @min-[120px]:block">{titles}</span>
        )}
      </span>
      {count > 0 && (
        <span
          className={`absolute top-1 left-1/2 hidden min-w-4 -translate-x-1/2 rounded-full bg-white/25 px-1 text-center text-[10px] leading-4 font-semibold tabular-nums @min-[18px]:block @min-[56px]:right-1 @min-[56px]:left-auto @min-[56px]:translate-x-0 ${
            badgeOnly ? '' : '@min-[120px]:hidden'
          }`}
        >
          {count}
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
