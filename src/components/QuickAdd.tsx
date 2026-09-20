import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'
import { Sheet } from './Sheet'
import { SpaceDot } from './TaskCard'
import { Button, ChipButton, field } from './ui'
import { formatDay, shiftISODate, toISODate } from '../lib/dates'
import type { ISODate, TaskPriority, TaskStatus } from '../domain/task'
import { ALL_SPACES, DEFAULT_SPACE_ID } from '../domain/space'

interface Props {
  onClose: () => void
  defaults?: { status?: TaskStatus; due?: ISODate }
}

/**
 * Create dialog: title + Enter, with one-tap chips for the things you most often set
 * at creation (Space, due Today/Tomorrow, priority). Everything else is edited afterwards.
 */
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
  const [due, setDue] = useState<ISODate | undefined>(defaults?.due)
  const [priority, setPriority] = useState<TaskPriority>('normal')

  const today = toISODate(new Date())
  const tomorrow = shiftISODate(today, 1)

  const submit = () => {
    if (!title.trim()) return
    add({ title, status: defaults?.status, due, priority, spaceId })
    setLastUsed(spaceId)
    onClose()
  }

  return (
    <Sheet
      onClose={onClose}
      size="sm"
      title="New task"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="quick-add" disabled={!title.trim()}>
            Add
          </Button>
        </div>
      }
    >
      <form
        id="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-4"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Title"
          enterKeyHint="done"
          className={`${field} min-h-12 text-lg md:text-base`}
        />

        {showPicker && (
          <div role="radiogroup" aria-label="Space" className="flex flex-wrap gap-1.5">
            {spaces.map((s) => (
              <ChipButton
                key={s.id}
                role="radio"
                aria-checked={s.id === spaceId}
                active={s.id === spaceId}
                onClick={() => setSpaceId(s.id)}
                className="inline-flex items-center gap-2"
              >
                <SpaceDot colour={s.colour} />
                {s.name}
              </ChipButton>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {defaults?.due ? (
            <ChipButton active onClick={() => setDue((d) => (d ? undefined : defaults.due))}>
              Due {formatDay(defaults.due, today)}
            </ChipButton>
          ) : (
            <>
              <ChipButton active={due === today} onClick={() => setDue((d) => (d === today ? undefined : today))}>
                Today
              </ChipButton>
              <ChipButton active={due === tomorrow} onClick={() => setDue((d) => (d === tomorrow ? undefined : tomorrow))}>
                Tomorrow
              </ChipButton>
            </>
          )}
          <span className="w-2" aria-hidden />
          <ChipButton
            active={priority === 'high'}
            onClick={() => setPriority((p) => (p === 'high' ? 'normal' : 'high'))}
            tone="warn"
          >
            ! High
          </ChipButton>
          <ChipButton
            active={priority === 'urgent'}
            onClick={() => setPriority((p) => (p === 'urgent' ? 'normal' : 'urgent'))}
            tone="danger"
          >
            !! Urgent
          </ChipButton>
        </div>
      </form>
    </Sheet>
  )
}
