import { useSync } from '../sync/status'
import { logout, sync } from '../sync/engine'

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
  const tone = status === 'error' ? 'text-red-600' : status === 'offline' ? 'text-amber-600' : 'text-neutral-500'
  return (
    <div className={`flex items-center gap-3 px-2 text-xs ${tone}`} title={error}>
      <button onClick={() => void sync()} className="hover:underline">
        {LABEL[status]}
      </button>
      <button onClick={() => void logout()} className="ml-auto text-neutral-400 hover:underline">
        Sign out
      </button>
    </div>
  )
}
