import { DAY, type Minutes } from '../../domain/block'

/**
 * The row's columns: label | ruler | tray on desktop; label | ruler on a phone, where
 * the tray wraps under the ruler (§5.2). Shared with the axis above the rows so the
 * hour labels line up with the rulers.
 */
export const ROW_GRID = 'grid grid-cols-[3rem_1fr] gap-x-2 gap-y-1.5 md:grid-cols-[3rem_1fr_minmax(0,9rem)]'

/** A span's place on the ruler in %, so bars scale with the row and never need measuring. */
export const spanStyle = (start: Minutes, end: Minutes) => ({
  left: `${(start / DAY) * 100}%`,
  width: `${((end - start) / DAY) * 100}%`,
})
