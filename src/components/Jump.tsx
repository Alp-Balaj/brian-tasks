import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PRIORITY_RANK, type Task } from '../domain/task'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { Sheet } from './Sheet'
import { SpaceDot } from './TaskCard'
import { SectionLabel, field } from './ui'
import { PAGES } from './pages'

type Hit = { kind: 'page'; to: string; label: string } | { kind: 'task'; task: Task }

const byPriority = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)

/**
 * PD-16, E10: type to reach anything. Open Tasks across every Space by title, then by
 * description; the pages by name. ↑↓ chooses, Enter opens. Searched in memory —
 * every Task is already on the Device.
 */
export function Jump({ onClose, onOpenTask }: { onClose: () => void; onOpenTask: (id: string) => void }) {
  const tasks = useTasks((s) => s.tasks)
  const spaces = useSpaces((s) => s.spaces)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const hits = useMemo((): Hit[] => {
    const q = query.trim().toLowerCase()
    const pages: Hit[] = PAGES.filter((p) => q !== '' && p.label.toLowerCase().startsWith(q)).map((p) => ({ kind: 'page', ...p }))
    const open = tasks.filter((t) => !t.archived && t.status !== 'done')
    const titled = open.filter((t) => t.title.toLowerCase().includes(q)).sort(byPriority)
    const described = q === '' ? [] : open.filter((t) => !titled.includes(t) && t.description.toLowerCase().includes(q)).sort(byPriority)
    return [...pages, ...[...titled, ...described].slice(0, 12).map((task): Hit => ({ kind: 'task', task }))]
  }, [tasks, query])
  const current = Math.min(active, Math.max(hits.length - 1, 0))

  const go = (hit: Hit) => {
    onClose()
    if (hit.kind === 'page') navigate(hit.to)
    else onOpenTask(hit.task.id)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min(current + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (e.key === 'Enter' && hits[current]) {
      e.preventDefault()
      go(hits[current])
    }
  }

  const optionId = (i: number) => `jump-${i}`
  return (
    <Sheet onClose={onClose} size="sm">
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded
          aria-controls="jump-list"
          aria-activedescendant={hits[current] ? optionId(current) : undefined}
          aria-label="Jump to"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a task or a page"
          className={`${field} min-h-12 text-base`}
        />
        <ul id="jump-list" role="listbox" aria-label="Matches" className="flex max-h-[60vh] flex-col overflow-auto pb-2">
          {hits.length === 0 && <li className="px-3 py-4 text-center text-sm text-fg-faint">Nothing matches.</li>}
          {hits.map((hit, i) => {
            const isActive = i === current
            const space = hit.kind === 'task' ? spaces.find((s) => s.id === hit.task.spaceId) : undefined
            return (
              <li key={hit.kind === 'page' ? hit.to : hit.task.id}>
                <button
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => go(hit)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${isActive ? 'bg-surface-2' : ''}`}
                >
                  {hit.kind === 'page' ? (
                    <>
                      <SectionLabel className="w-10 shrink-0">Page</SectionLabel>
                      <span>{hit.label}</span>
                    </>
                  ) : (
                    <>
                      <SpaceDot colour={space?.colour ?? '#d4d4d4'} title={space?.name} />
                      <span className="line-clamp-1 flex-1">{hit.task.title}</span>
                      {hit.task.due && <span className="shrink-0 text-xs text-fg-faint tabular-nums">{hit.task.due}</span>}
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
