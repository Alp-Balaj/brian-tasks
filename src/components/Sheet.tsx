import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { IconButton } from './ui'

/**
 * Overlay container: bottom sheet on mobile, right-side panel on desktop.
 * Closes on backdrop click, the close button or Escape. `title` gives it a sticky header;
 * `footer` a sticky bottom bar. The body scrolls so the keyboard never hides a field.
 */
export function Sheet({
  onClose,
  title,
  footer,
  children,
  size = 'md',
}: {
  onClose: () => void
  title?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** `sm` for short dialogs (quick add, menus); `md` for editors. */
  size?: 'sm' | 'md'
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep the page behind from scrolling while the sheet is up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-20 flex items-end bg-black/40 md:items-stretch md:justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl md:h-full md:max-h-none md:rounded-none md:border-l md:border-line ${
          size === 'sm' ? 'max-h-[85dvh] md:w-[400px]' : 'max-h-[94dvh] md:w-[460px]'
        }`}
      >
        {/* Drag-handle affordance (visual only) on phones. */}
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        {title !== undefined && (
          <header className="flex items-center gap-2 px-4 pt-1 pb-1 md:pt-3">
            <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
            <IconButton label="Close" onClick={onClose} className="-mr-2">
              <CloseIcon />
            </IconButton>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>

        {footer && (
          <footer className="border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
        {!footer && <div className="h-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>
  )
}
