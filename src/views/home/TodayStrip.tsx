import type { ISODate } from '../../domain/task'

/** P0 stub. P3 builds today's strip here: blocks, placements, now-marker, "Now ·" line (TB-20, §5.6). */
export function TodayStrip(_props: { today: ISODate }) {
  return <div className="text-sm text-fg-muted">TodayStrip</div>
}
