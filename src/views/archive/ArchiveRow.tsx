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
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50">
      {colour && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colour }} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-neutral-700">{title}</div>
        <div className="truncate text-xs text-neutral-500">{secondary}</div>
      </div>
      <button
        onClick={onRestore}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-900"
      >
        Restore
      </button>
      <button onClick={onDelete} className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-red-600">
        Delete
      </button>
    </li>
  )
}
