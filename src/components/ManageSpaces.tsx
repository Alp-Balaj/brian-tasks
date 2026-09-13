import { useState } from 'react'
import { DEFAULT_SPACE_ID, SPACE_COLOURS, type Space } from '../domain/space'
import { useSpaces } from '../store/spaces'
import { Sheet } from './Sheet'
import { SpaceDot } from './TaskCard'

const field =
  'min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900'
const iconButton =
  'rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent'

/** First palette colour no Space uses yet, so new Spaces stay tellable apart by default. */
const nextFreeColour = (spaces: Space[]) =>
  SPACE_COLOURS.find((c) => !spaces.some((s) => s.colour === c)) ?? SPACE_COLOURS[0]

/**
 * Create, rename, recolour, reorder and delete Spaces (Q16, Q17). Every change is saved
 * immediately, like TaskEditor. The default Space can be edited but not deleted.
 */
export function ManageSpaces({ onClose }: { onClose: () => void }) {
  const spaces = useSpaces((s) => s.spaces)
  const add = useSpaces((s) => s.add)
  const update = useSpaces((s) => s.update)
  const reorder = useSpaces((s) => s.reorder)
  const remove = useSpaces((s) => s.remove)

  const [name, setName] = useState('')
  const [colour, setColour] = useState(() => nextFreeColour(spaces))

  const defaultName = spaces.find((s) => s.id === DEFAULT_SPACE_ID)?.name ?? 'Personal'

  const create = () => {
    if (!name.trim()) return
    add(name, colour)
    setName('')
    setColour(nextFreeColour(useSpaces.getState().spaces))
  }

  const shift = (index: number, delta: -1 | 1) => {
    const ids = spaces.map((s) => s.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder(ids)
  }

  const confirmRemove = (space: Space) => {
    if (confirm(`Delete "${space.name}"? Its tasks move to ${defaultName}.`)) remove(space.id)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="text-lg font-semibold">Spaces</div>

        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {spaces.map((space, i) => (
            <SpaceRow
              key={space.id}
              space={space}
              onRename={(n) => update(space.id, { name: n })}
              onRecolour={(c) => update(space.id, { colour: c })}
              onUp={i > 0 ? () => shift(i, -1) : undefined}
              onDown={i < spaces.length - 1 ? () => shift(i, 1) : undefined}
              onDelete={space.id === DEFAULT_SPACE_ID ? undefined : () => confirmRemove(space)}
            />
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-xs text-neutral-500">New space</label>
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work" className={field} />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <ColourPicker value={colour} onChange={setColour} />
        </form>

        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-neutral-100">
            Done
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function SpaceRow({
  space,
  onRename,
  onRecolour,
  onUp,
  onDown,
  onDelete,
}: {
  space: Space
  onRename: (name: string) => void
  onRecolour: (colour: string) => void
  onUp?: () => void
  onDown?: () => void
  onDelete?: () => void
}) {
  const [picking, setPicking] = useState(false)
  return (
    <li className="flex flex-col gap-2 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          title="Change colour"
          className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-neutral-100"
        >
          <SpaceDot colour={space.colour} className="h-3 w-3" />
        </button>
        <NameField value={space.name} onCommit={onRename} />
        <button type="button" onClick={onUp} disabled={!onUp} title="Move up" className={iconButton}>
          ↑
        </button>
        <button type="button" onClick={onDown} disabled={!onDown} title="Move down" className={iconButton}>
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!onDelete}
          title={onDelete ? 'Delete space' : 'The default space cannot be deleted'}
          className={`${iconButton} hover:text-red-600`}
        >
          ×
        </button>
      </div>
      {picking && (
        <div className="pl-9">
          <ColourPicker
            value={space.colour}
            onChange={(c) => {
              onRecolour(c)
              setPicking(false)
            }}
          />
        </div>
      )}
    </li>
  )
}

/** Local draft so the field can be emptied while typing; an empty commit reverts. */
function NameField({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else setDraft(value)
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label="Space name"
      className={field}
    />
  )
}

function ColourPicker({ value, onChange }: { value: string; onChange: (colour: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {SPACE_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full ring-offset-2 ${c === value ? 'ring-2 ring-neutral-900' : 'hover:ring-2 hover:ring-neutral-300'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
