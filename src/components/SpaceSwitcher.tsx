import { useEffect, useRef, useState } from 'react'
import { ALL_SPACES, type SpaceSelection } from '../domain/space'
import { useSpaces } from '../store/spaces'
import { useSpaceSelection } from '../store/ui'
import { ManageSpaces } from './ManageSpaces'
import { SpaceDot } from './TaskCard'

/** Hollow dot: the "All spaces" choice is not a Space, so it gets no colour. */
const AllDot = () => <span className="inline-block h-2 w-2 shrink-0 rounded-full border-2 border-neutral-400" />

/**
 * Sidebar / mobile-header dropdown: every Space with its colour dot, "All spaces",
 * then "Manage spaces…" (Q3, Q4, Q15). Rendered on every page; Home simply ignores
 * the selection.
 */
export function SpaceSwitcher() {
  const spaces = useSpaces((s) => s.spaces)
  const selected = useSpaceSelection((s) => s.selected)
  const select = useSpaceSelection((s) => s.select)
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = selected === ALL_SPACES ? undefined : spaces.find((s) => s.id === selected)

  const choose = (sel: SpaceSelection) => {
    select(sel)
    setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Space"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm hover:border-neutral-400"
      >
        {current ? <SpaceDot colour={current.colour} /> : <AllDot />}
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? 'All spaces'}</span>
        <span className="text-xs text-neutral-400">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1 w-max min-w-full max-w-64 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {spaces.map((s) => (
            <Option key={s.id} active={s.id === selected} onClick={() => choose(s.id)}>
              <SpaceDot colour={s.colour} />
              <span className="truncate">{s.name}</span>
            </Option>
          ))}
          <Option active={selected === ALL_SPACES} onClick={() => choose(ALL_SPACES)}>
            <AllDot />
            All spaces
          </Option>
          <div className="my-1 border-t border-neutral-200" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setManaging(true)
            }}
            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100"
          >
            Manage spaces…
          </button>
        </div>
      )}

      {managing && <ManageSpaces onClose={() => setManaging(false)} />}
    </div>
  )
}

function Option({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 ${
        active ? 'font-medium' : ''
      }`}
    >
      {children}
    </button>
  )
}
