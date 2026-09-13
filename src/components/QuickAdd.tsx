import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'
import { Sheet } from './Sheet'
import { SpaceDot } from './TaskCard'
import type { ISODate, TaskStatus } from '../domain/task'
import { ALL_SPACES, DEFAULT_SPACE_ID } from '../domain/space'

interface Props {
  onClose: () => void
  defaults?: { status?: TaskStatus; due?: ISODate }
}

/** Minimal create dialog: title + Enter. Details are edited afterwards in TaskEditor. */
export function QuickAdd({ onClose, defaults }: Props) {
  const add = useTasks((s) => s.add)
  const spaces = useSpaces((s) => s.spaces)
  const selected = useSpaceSelection((s) => s.selected)
  const lastUsedSpaceId = useSpaceSelection((s) => s.lastUsedSpaceId)
  const setLastUsed = useSpaceSelection((s) => s.setLastUsed)
  const { pathname } = useLocation()

  // Q18: inside one space the task files there silently. From "All spaces" or Home
  // there is no obvious target, so ask — preselecting the space used last time.
  const showPicker = selected === ALL_SPACES || pathname.startsWith('/home')
  const exists = (id: string) => spaces.some((s) => s.id === id)
  const [spaceId, setSpaceId] = useState(() => {
    const preferred = showPicker ? lastUsedSpaceId : selected
    return exists(preferred) ? preferred : DEFAULT_SPACE_ID
  })
  const [title, setTitle] = useState('')

  const space = spaces.find((s) => s.id === spaceId)

  const submit = () => {
    if (!title.trim()) return
    add({ title, ...defaults, spaceId })
    setLastUsed(spaceId)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-3"
      >
        <label className="text-sm font-medium">New task</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
        {showPicker && (
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            {space && <SpaceDot colour={space.colour} />}
            <span>Space</span>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {defaults?.due && <div className="text-xs text-neutral-500">Due {defaults.due}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-neutral-100">
            Cancel
          </button>
          <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white">
            Add
          </button>
        </div>
      </form>
    </Sheet>
  )
}
