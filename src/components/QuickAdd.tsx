import { useState } from 'react'
import { useTasks } from '../store/tasks'
import { Sheet } from './Sheet'
import type { ISODate, TaskStatus } from '../domain/task'

interface Props {
  onClose: () => void
  defaults?: { status?: TaskStatus; due?: ISODate }
}

/** Minimal create dialog: title + Enter. Details are edited afterwards in TaskEditor. */
export function QuickAdd({ onClose, defaults }: Props) {
  const add = useTasks((s) => s.add)
  const [title, setTitle] = useState('')

  const submit = () => {
    if (!title.trim()) return
    add({ title, ...defaults })
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
