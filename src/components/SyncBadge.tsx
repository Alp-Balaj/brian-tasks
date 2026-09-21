import { useSync } from '../sync/status'
import { logout, sync } from '../sync/engine'
import { NotifyToggle } from './NotifyToggle'

const LABEL = {
  unknown: 'Connecting…',
  'signed-out': 'Signed out',
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed',
} as const

/** One line in the sidebar: where this Device stands with the server, and a way out. */
export function SyncBadge() {
  const { status, error } = useSync()
  const tone = status === 'error' ? 'text-danger' : status === 'offline' ? 'text-warn' : 'text-fg-faint'
  return (
    <div className={`flex items-center gap-3 px-2 text-xs ${tone}`} title={error}>
      <button onClick={() => void sync()} className="hover:underline">
        {LABEL[status]}
      </button>
      <button onClick={() => void logout()} className="ml-auto text-fg-faint hover:underline">
        Sign out
      </button>
      <NotifyToggle className="-my-1" />
    </div>
  )
}
