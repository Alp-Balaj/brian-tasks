import { useEffect } from 'react'

/** Whether a key press belongs to a text field or a sheet, so a bare letter must not act (PD-15). */
const typing = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * PD-15: bare keys outside any text field. `bindings` maps a key to its action; `⌘K` /
 * `Ctrl K` are matched with `meta+k`. Anything with another modifier is left to the
 * browser. Escape is not here: each Sheet already closes itself on it.
 */
export function useShortcuts(bindings: Record<string, () => void>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const combo = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey ? `meta+${key}` : e.altKey || e.ctrlKey || e.metaKey ? '' : key
      const action = bindings[combo]
      if (!action) return
      if (!combo.startsWith('meta+') && typing(e.target)) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, enabled])
}
