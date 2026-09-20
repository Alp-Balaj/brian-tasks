import { create } from 'zustand'

/**
 * What this Device knows about the server right now. Only `signed-out` blocks
 * the UI (it shows the login screen); everything else the app keeps working
 * through, since the local store is the source of truth.
 */
export type SyncStatus =
  | 'unknown' // before the first session check
  | 'signed-out'
  | 'idle' // signed in, nothing in flight, last sync succeeded
  | 'syncing'
  | 'offline' // the server could not be reached; will retry when back online
  | 'error' // the server replied with something other than 401

interface SyncState {
  status: SyncStatus
  lastSyncedAt?: string
  error?: string
}

export const useSync = create<SyncState>(() => ({ status: 'unknown' }))
