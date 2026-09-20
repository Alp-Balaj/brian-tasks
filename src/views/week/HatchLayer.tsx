import { DAY, overlapRegions, overlaps, type Block, type Minutes, type Placement } from '../../domain/block'

type Span = { start: Minutes; end: Minutes }

/** Merge sorted-or-not spans that touch or overlap into disjoint spans by start. */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Span[] = []
  for (const s of sorted) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }
  return merged
}

/**
 * Where two blocks coincide (TB-6) and where a timed placement sits on a block
 * (TB-12). Placements over each other are not hatched: their outlines already show it.
 */
function hatchRegions(blocks: readonly Block[], timed: readonly Span[]): Span[] {
  const pieces: Span[] = overlapRegions(blocks)
  for (const p of timed) {
    for (const b of blocks) {
      if (overlaps(p, b)) pieces.push({ start: Math.max(p.start, b.start), end: Math.min(p.end, b.end) })
    }
  }
  return mergeSpans(pieces)
}

/**
 * Hatched overlap regions, drawn over the blocks and under the placements so a
 * doubled hour is tellable from a plain one at a glance (TB-6, TB-12). Not tappable:
 * the bars underneath are.
 */
export function HatchLayer({ blocks, placements }: { blocks: readonly Block[]; placements: readonly Placement[] }) {
  const timed = placements.filter((p): p is Placement & Span => p.start !== undefined && p.end !== undefined)
  const regions = hatchRegions(blocks, timed)
  if (regions.length === 0) return null
  return (
    <>
      {regions.map((r) => (
        <span
          key={`${r.start}-${r.end}`}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-20"
          style={{
            left: `${(r.start / DAY) * 100}%`,
            width: `${((r.end - r.start) / DAY) * 100}%`,
            // Diagonal hatching in the text colour, kept faint so bar names stay legible through it.
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--fg) 0, var(--fg) 1.5px, transparent 1.5px, transparent 7px)',
            opacity: 0.18,
          }}
        />
      ))}
    </>
  )
}
