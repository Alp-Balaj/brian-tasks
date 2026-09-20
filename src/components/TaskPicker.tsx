import type { ISODate, Task } from '../domain/task'

interface Props {
  /** The day being planned: its unplaced Scheduled tasks come first (TB-10). */
  date: ISODate
  onPick: (task: Task) => void
}

/** P0 stub. P2 builds the picker here (§5.5), shared by BlockSheet and PlacementSheet. */
export function TaskPicker(_props: Props) {
  return <div className="text-sm text-fg-muted">TaskPicker</div>
}
