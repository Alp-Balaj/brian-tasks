import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushState, type PushState } from '../push'
import { BellIcon } from './icons'

const TITLE: Record<PushState, string> = {
  unsupported: 'Notifications are not supported in this browser',
  unavailable: 'Notifications are not set up on the server',
  denied: 'Notifications are blocked for this site in the browser',
  off: 'Turn notifications on for this Device',
  on: 'Notifications are on for this Device — tap to turn off',
}

/**
 * PD-17: the bell next to the sync badge. Per Device, opt-in; what it is told is
 * fixed (PD-18). Greyed with a reason when the browser or the server cannot.
 */
export function NotifyToggle({ className = '' }: { className?: string }) {
  const [state, setState] = useState<PushState | 'busy'>('busy')

  useEffect(() => {
    let live = true
    void pushState().then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [])

  const toggle = async () => {
    if (state === 'busy') return
    const was = state
    setState('busy')
    try {
      setState(was === 'on' ? await disablePush() : await enablePush())
    } catch {
      setState(was)
    }
  }

  const can = state === 'on' || state === 'off'
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={!can}
      aria-pressed={state === 'on'}
      aria-label={state === 'busy' ? 'Notifications' : TITLE[state]}
      title={state === 'busy' ? undefined : TITLE[state]}
      className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
        state === 'on' ? 'text-accent' : 'text-fg-faint'
      } ${can ? 'hover:bg-surface-2 hover:text-fg' : 'opacity-40'} ${className}`}
    >
      <BellIcon size={16} />
    </button>
  )
}
