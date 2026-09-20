import { useState, type ComponentType } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { ISODate, Task } from '../domain/task'
import type { Minutes, NewBlock } from '../domain/block'
import { TaskEditor } from './TaskEditor'
import { QuickAdd } from './QuickAdd'
import { BlockSheet } from './BlockSheet'
import { PlacementSheet } from './PlacementSheet'
import { SpaceSwitcher } from './SpaceSwitcher'
import { SyncBadge } from './SyncBadge'
import { ArchiveIcon, BoardIcon, CalendarIcon, HomeIcon, ListIcon, PlusIcon, WeekIcon } from './icons'

/** The five mobile tabs (the platform maximum). Archive is desktop-sidebar only, plus a footer link on List (Q29). */
const NAV: { to: string; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/week', label: 'Week', Icon: WeekIcon },
  { to: '/board', label: 'Board', Icon: BoardIcon },
  { to: '/list', label: 'List', Icon: ListIcon },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon },
]

const sidebarLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm ${
    isActive ? 'bg-surface-2 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
  }`

/** What the block sheet is open on: an existing block, or a new one on `date`. */
type BlockSheetState = { blockId: string | null; date: ISODate; preset?: Partial<NewBlock> }
/** What the placement sheet is open on: an existing placement, or a new one on `date`. */
type PlacementSheetState = { placementId: string | null; date: ISODate; preset?: { start?: Minutes; end?: Minutes; taskId?: string } }

/**
 * App frame. Desktop: left sidebar + content. Mobile: header + content + bottom tab bar,
 * with the add button floating above the tabs (thumb-reachable, HIG/M3 placement).
 * The selected task (for editing) is app-level state so every view can open it; so
 * are the block and placement sheets, which Home and Week share (§5.1).
 */
export function Shell() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [blockSheet, setBlockSheet] = useState<BlockSheetState | null>(null)
  const [placementSheet, setPlacementSheet] = useState<PlacementSheetState | null>(null)

  const shell: ShellContext = {
    openTask: setEditingId,
    openBlock: (id, date) => setBlockSheet({ blockId: id, date }),
    newBlock: (date, preset) => setBlockSheet({ blockId: null, date, preset }),
    openPlacement: (id, date) => setPlacementSheet({ placementId: id, date }),
    placeTask: (task, date, span) => setPlacementSheet({ placementId: null, date, preset: { ...span, taskId: task?.id } }),
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface p-3 md:flex">
        <div className="mb-3 px-3 text-lg font-semibold">Brian Tasks</div>
        <div className="mb-4 px-1">
          <SpaceSwitcher />
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={sidebarLink}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <NavLink to="/archive" className={(a) => `${sidebarLink(a)} mt-3`}>
            <ArchiveIcon size={18} />
            Archive
          </NavLink>
        </nav>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-accent-fg hover:opacity-90"
        >
          <PlusIcon size={18} />
          New task
        </button>
        <div className="mt-3">
          <SyncBadge />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <div className="min-w-0 py-2">
          <div className="font-semibold">Brian Tasks</div>
          <SyncBadge />
        </div>
        <div className="w-44 shrink-0">
          <SpaceSwitcher />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet context={shell} />
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        aria-label="New task"
        className="fixed right-4 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1rem)] z-10 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-black/20 active:scale-95 md:hidden"
      >
        <PlusIcon size={26} />
      </button>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex h-tabbar flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-accent' : 'text-fg-faint'
              }`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>

      {editingId && <TaskEditor taskId={editingId} onClose={() => setEditingId(null)} />}
      {blockSheet && <BlockSheet {...blockSheet} onClose={() => setBlockSheet(null)} />}
      {placementSheet && <PlacementSheet {...placementSheet} onClose={() => setPlacementSheet(null)} />}
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}

export interface ShellContext {
  openTask: (id: string) => void
  /** An existing block's sheet, as seen from `date`: its week is where edits apply from (TB-5). */
  openBlock: (id: string, date: ISODate) => void
  /** A new block draft on `date`; `preset` prefills e.g. the span from a drag (TB-13, TB-22). */
  newBlock: (date: ISODate, preset?: Partial<NewBlock>) => void
  /** An existing placement's sheet. */
  openPlacement: (id: string, date: ISODate) => void
  /**
   * The placement form for `task` on `date` (TB-13): from a tray chip, or from a drag
   * with the span and no task yet (`null` — the form asks for one).
   */
  placeTask: (task: Task | null, date: ISODate, span?: { start: Minutes; end: Minutes }) => void
}
