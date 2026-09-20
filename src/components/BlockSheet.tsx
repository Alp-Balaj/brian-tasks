import type { ISODate } from '../domain/task'
import type { NewBlock } from '../domain/block'
import { Sheet } from './Sheet'

interface Props {
  /** `null` creates a new block; the form is a local draft until "Add". */
  blockId: string | null
  /** The day the sheet was opened from; its week is where edits apply from (TB-5). */
  date: ISODate
  preset?: Partial<NewBlock>
  onClose: () => void
}

/** P0 stub. P2 builds the block sheet here (TB-10, §5.3). */
export function BlockSheet({ onClose }: Props) {
  return (
    <Sheet onClose={onClose} title="BlockSheet">
      <div className="px-4 pb-4 text-sm text-fg-muted">BlockSheet</div>
    </Sheet>
  )
}
