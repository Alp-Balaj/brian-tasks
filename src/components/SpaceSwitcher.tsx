import { ALL_SPACES } from '../domain/space'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'

/**
 * S0 stub: a plain select over the spaces plus "All spaces". S1 replaces this
 * with the real switcher (colour dots, "Manage spaces…").
 */
export function SpaceSwitcher() {
  const spaces = useSpaces((s) => s.spaces)
  const selected = useSpaceSelection((s) => s.selected)
  const select = useSpaceSelection((s) => s.select)

  return (
    <select
      aria-label="Space"
      value={selected}
      onChange={(e) => select(e.target.value)}
      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
    >
      {spaces.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      <option value={ALL_SPACES}>All spaces</option>
    </select>
  )
}
