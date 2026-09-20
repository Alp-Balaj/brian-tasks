import type { ISODate } from '../domain/task'
import type { Minutes } from '../domain/block'
import { Sheet } from './Sheet'

interface Props {
  /** `null` creates a new placement (Path B, TB-13); the form is a local draft until "Add". */
  placementId: string | null
  date: ISODate
  preset?: { start?: Minutes; end?: Minutes; taskId?: string }
  onClose: () => void
}

/** P0 stub. P2 builds the placement form here (§5.4). */
export function PlacementSheet({ onClose }: Props) {
  return (
    <Sheet onClose={onClose} title="PlacementSheet">
      <div className="px-4 pb-4 text-sm text-fg-muted">PlacementSheet</div>
    </Sheet>
  )
}
