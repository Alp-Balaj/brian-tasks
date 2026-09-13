import { useEffect, type ReactNode } from 'react'

/**
 * Overlay container: bottom sheet on mobile, right-side panel on desktop.
 * Closes on backdrop click or Escape.
 */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/30 md:items-stretch md:justify-end" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-auto rounded-t-2xl bg-white p-4 shadow-xl md:h-full md:max-h-none md:w-[420px] md:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
