import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { TaskEditor } from './TaskEditor'
import { QuickAdd } from './QuickAdd'
import { SpaceSwitcher } from './SpaceSwitcher'
import { SyncBadge } from './SyncBadge'

/** The four mobile tabs. Archive is desktop-sidebar only, plus a footer link on List (Q29). */
const NAV = [
  { to: '/home', label: 'Home', icon: '⌂' },
  { to: '/board', label: 'Board', icon: '▦' },
  { to: '/list', label: 'List', icon: '☰' },
  { to: '/calendar', label: 'Calendar', icon: '▤' },
]

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`

/**
 * App frame. Desktop: left sidebar + content. Mobile: content + bottom tab bar.
 * The selected task (for editing) is app-level state so every view can open it.
 */
export function Shell() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-neutral-200 bg-white p-3 md:flex">
        <div className="mb-3 px-2 text-lg font-semibold">Brian Tasks</div>
        <div className="mb-4 px-1">
          <SpaceSwitcher />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={navLink}>
              <span className="mr-2">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/archive" className={(a) => `${navLink(a)} mt-3 text-neutral-500`}>
            <span className="mr-2">▣</span>
            Archive
          </NavLink>
        </nav>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="mt-auto rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + New task
        </button>
        <div className="mt-3">
          <SyncBadge />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        <div className="-mx-2">
          <div className="px-2 font-semibold">Brian Tasks</div>
          <SyncBadge />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <SpaceSwitcher />
          </div>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            + New
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet context={{ openTask: setEditingId } satisfies ShellContext} />
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-2 text-xs ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`
            }
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      {editingId && <TaskEditor taskId={editingId} onClose={() => setEditingId(null)} />}
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}

export interface ShellContext {
  openTask: (id: string) => void
}
