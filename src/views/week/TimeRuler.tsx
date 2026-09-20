import { DAY } from '../../domain/block'

/** The labelled hours of the shared axis. */
const HOURS = [0, 6, 12, 18, 24]

/**
 * The hour axis (00 06 12 18 24), rendered once above the day rows and aligned with
 * their ruler column. The labels sit at the same percentages the bars use, so a
 * bar at 09:00 lines up with the tick halfway between 06 and 12.
 */
export function TimeRuler({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative h-4 text-[10px] tabular-nums text-fg-faint ${className}`}>
      {HOURS.map((h) => {
        // The first and last labels are pinned inside the edges; the rest are centred on the tick.
        const shift = h === 0 ? '0' : h === 24 ? '-100%' : '-50%'
        return (
          <span
            key={h}
            className="absolute top-0 leading-4"
            style={{ left: `${((h * 60) / DAY) * 100}%`, transform: `translateX(${shift})` }}
          >
            {String(h).padStart(2, '0')}
          </span>
        )
      })}
    </div>
  )
}
