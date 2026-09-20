import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { ISODate } from '../../domain/task'
import { DAY, STEP, snap, weekOf, type Minutes } from '../../domain/block'
import { useBlocks } from '../../store/blocks'

export type Span = { start: Minutes; end: Minutes }
export type BarKind = 'block' | 'placement'
export type Edge = 'start' | 'end'

/** The bar a move or resize is on, and how to open its sheet when it turns out to be a click. */
type Target = { kind: BarKind; id: string; span: Span; open: () => void }

type Session =
  | { mode: 'create'; origin: Minutes; span: Span }
  /** `origin` is the unsnapped pointer position at pointerdown; the bar keeps its length. */
  | { mode: 'move'; target: Target; origin: Minutes; span: Span }
  | { mode: 'resize'; target: Target; edge: Edge; span: Span }

/** What a bar spreads on itself: its body starts a move, its edge handles a resize. */
export interface BarDrag {
  onPointerDown: (e: ReactPointerEvent) => void
  onHandlePointerDown: (edge: Edge, e: ReactPointerEvent) => void
}

/** A finished create drag waiting for "New block" or "Place a task" (TB-13 Path B). `x` is px from the ruler's left edge. */
export interface Choice extends Span {
  x: number
}

const POPOVER_HALF_WIDTH = 90

const clamp = (m: Minutes, lo: Minutes, hi: Minutes) => Math.min(hi, Math.max(lo, m))

/** Where the session's span goes when the pointer is at `m` (unsnapped minutes). Pure. */
function advance(s: Session, m: Minutes): Session {
  switch (s.mode) {
    case 'create': {
      const c = snap(m)
      return { ...s, span: { start: Math.min(s.origin, c), end: Math.max(s.origin, c) } }
    }
    case 'move': {
      const { start, end } = s.target.span
      const length = end - start
      const next = clamp(snap(start + (m - s.origin)), 0, DAY - length)
      return { ...s, span: { start: next, end: next + length } }
    }
    case 'resize': {
      const { start, end } = s.target.span
      // The other edge stays put; a bar keeps at least one step and never inverts.
      const span = s.edge === 'start' ? { start: clamp(snap(m), 0, end - STEP), end } : { start, end: clamp(snap(m), start + STEP, DAY) }
      return { ...s, span }
    }
  }
}

const sameSpan = (a: Span, b: Span) => a.start === b.start && a.end === b.end

/** `(pointer: fine)` now, followed live — the drag is a mouse thing (TB-22). */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)
  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)')
    const onChange = () => setFine(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return fine
}

/**
 * Desktop editing on a day's ruler (§5.8, TB-22, D10): drag on empty time to create,
 * drag a bar to move it, drag its edges to resize. Raw pointer events with capture on
 * the ruler; every position snapped to STEP and kept inside the day. Only under
 * `(pointer: fine)` and when `enabled` — otherwise every prop is inert and the row
 * behaves exactly as on a phone.
 *
 * A create ends in a choice (`choice`) rather than a write: the caller draws the
 * popover. A move or resize writes on release; a press without movement is a click
 * and opens the bar's sheet. Escape cancels whichever is under way.
 */
export function useRulerDrag(date: ISODate, enabled = true) {
  const active = useFinePointer() && enabled
  const ruler = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<Session | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  // The click that follows a captured pointerup would open a sheet after a drag; it is eaten once.
  const swallowClick = useRef(false)
  const updateBlockFrom = useBlocks((s) => s.updateBlockFrom)
  const updatePlacement = useBlocks((s) => s.updatePlacement)

  const update = (next: Session | null) => {
    sessionRef.current = next
    setSession(next)
  }

  const minutesAt = (clientX: number): Minutes => {
    const rect = ruler.current!.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * DAY
  }

  const begin = (e: ReactPointerEvent, next: Session) => {
    if (!active || e.button !== 0 || e.pointerType === 'touch' || !ruler.current) return
    swallowClick.current = false
    setChoice(null)
    ruler.current.setPointerCapture(e.pointerId)
    // No compat mouse events: nothing gets selected or focused while dragging.
    e.preventDefault()
    update(next)
  }

  const release = (pointerId: number) => {
    const el = ruler.current
    if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
  }

  const commit = (target: Target, span: Span) => {
    if (target.kind === 'block') updateBlockFrom(target.id, weekOf(date), span)
    else updatePlacement(target.id, span)
  }

  const finish = (s: Session, e: ReactPointerEvent) => {
    swallowClick.current = true
    update(null)
    release(e.pointerId)
    if (s.mode === 'create') {
      if (s.span.end - s.span.start < STEP) return
      const rect = ruler.current!.getBoundingClientRect()
      const x = clamp(e.clientX - rect.left, POPOVER_HALF_WIDTH, Math.max(POPOVER_HALF_WIDTH, rect.width - POPOVER_HALF_WIDTH))
      setChoice({ ...s.span, x })
      return
    }
    if (sameSpan(s.span, s.target.span)) {
      if (s.mode === 'move') s.target.open()
      return
    }
    commit(s.target, s.span)
  }

  const cancel = () => {
    if (!sessionRef.current) return
    update(null)
  }

  const rulerProps = {
    ref: ruler,
    onPointerDown: (e: ReactPointerEvent) => {
      const at = snap(minutesAt(e.clientX))
      begin(e, { mode: 'create', origin: at, span: { start: at, end: at } })
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = sessionRef.current
      if (s) update(advance(s, minutesAt(e.clientX)))
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = sessionRef.current
      if (s) finish(s, e)
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClickCapture: (e: ReactMouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }

  const bar = (kind: BarKind, id: string, span: Span, open: () => void): BarDrag | undefined => {
    if (!active) return undefined
    const target: Target = { kind, id, span, open }
    return {
      onPointerDown: (e) => {
        e.stopPropagation()
        begin(e, { mode: 'move', target, origin: minutesAt(e.clientX), span })
      },
      onHandlePointerDown: (edge, e) => {
        e.stopPropagation()
        begin(e, { mode: 'resize', target, edge, span })
      },
    }
  }

  /** `item` with the span it is being dragged to, when it is the bar under the pointer. */
  const previewed = <T extends Span>(kind: BarKind, id: string, item: T): T =>
    session && session.mode !== 'create' && session.target.kind === kind && session.target.id === id ? { ...item, ...session.span } : item

  const dragging = session !== null
  const choosing = choice !== null

  // Escape cancels the drag (the pointerup and click still come; the click is eaten) or closes the choice.
  useEffect(() => {
    if (!dragging && !choosing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (sessionRef.current) {
        swallowClick.current = true
        update(null)
      }
      setChoice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragging, choosing])

  // The choice goes away on a press anywhere but on it.
  useEffect(() => {
    if (!choosing) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-drag-choice]')) setChoice(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [choosing])

  // The pointer may leave the ruler mid-drag (capture keeps the events coming); the cursor should not change under it.
  const mode = session?.mode
  useEffect(() => {
    if (!mode) return
    const prev = document.body.style.cursor
    document.body.style.cursor = mode === 'move' ? 'grabbing' : mode === 'resize' ? 'ew-resize' : 'crosshair'
    return () => {
      document.body.style.cursor = prev
    }
  }, [mode])

  const ghost: Span | null = session?.mode === 'create' ? session.span : choice ? { start: choice.start, end: choice.end } : null

  return {
    enabled: active,
    rulerProps,
    bar,
    previewed,
    /** The span being drawn on empty time, while dragging and while the choice is up. */
    ghost: ghost && ghost.end > ghost.start ? ghost : null,
    choice,
    dismiss: () => setChoice(null),
  }
}
