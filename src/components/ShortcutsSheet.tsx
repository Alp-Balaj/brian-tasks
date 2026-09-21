import { Sheet } from './Sheet'
import { PAGES } from './pages'

const KEYS: [string, string][] = [
  ['n', 'New task'],
  ['⌘K / Ctrl K', 'Jump to a task or a page'],
  ...PAGES.map((p): [string, string] => [p.key, p.label]),
  ['?', 'This list'],
  ['Esc', 'Close the sheet'],
]

/** PD-15: what the keyboard does, for `?`. */
export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} size="sm" title="Keyboard">
      <ul className="flex flex-col pb-2">
        {KEYS.map(([key, what]) => (
          <li key={key} className="flex min-h-10 items-center justify-between gap-3 px-3 text-sm">
            <span>{what}</span>
            <kbd className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted">{key}</kbd>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
