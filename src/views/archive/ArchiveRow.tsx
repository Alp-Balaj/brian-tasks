import { Button } from '../../components/ui'

/** One archived thing (Task or Routine). Presentation only; the view decides what the lines say. */
export function ArchiveRow({
  title,
  secondary,
  colour,
  onRestore,
  onDelete,
}: {
  title: string
  secondary: string
  /** Space colour dot; shown only in "All spaces" (Q30). Routines never pass one. */
  colour?: string
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-3 py-2">
      {colour && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colour }} />}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[15px] leading-snug text-fg-muted">{title}</div>
        <div className="truncate text-xs text-fg-faint">{secondary}</div>
      </div>
      <Button variant="secondary" onClick={onRestore} className="min-h-9 px-3 text-xs">
        Restore
      </Button>
      <Button variant="danger" onClick={onDelete} className="min-h-9 px-2 text-xs">
        Delete
      </Button>
    </li>
  )
}
