// Keeps this Device caught up with the server: pushes everything it has (the
// server keeps only what is newer), pulls everything that changed since its
// cursor, and folds the result into the stores. Runs on open, after local
// changes, when connectivity returns, and on a slow timer while visible.
import { applySnapshot, currentSnapshot } from '../store/persist'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { useRoutines } from '../store/routines'
import { useBlocks } from '../store/blocks'
import { useTombstones } from '../store/tombstones'
import { api, ApiError } from './client'
import { applyRemote, toRows } from './merge'
import { useSync } from './status'

const CURSOR_KEY = 'brian-tasks:sync'
const DEBOUNCE_MS = 1000
const HEARTBEAT_MS = 60_000

let started = false
let inFlight = false
let runAgain = false
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

export async function startSync(): Promise<void> {
  if (started) return
  started = true

  const schedule = () => {
    if (applying) return
    clearTimeout(timer)
    timer = setTimeout(() => void sync(), DEBOUNCE_MS)
  }
  useTasks.subscribe(schedule)
  useSpaces.subscribe(schedule)
  useRoutines.subscribe(schedule)
  useBlocks.subscribe(schedule)
  useTombstones.subscribe(schedule)

  window.addEventListener('online', () => void sync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync()
  }, HEARTBEAT_MS)

  await checkSession()
  if (useSync.getState().status !== 'signed-out') await sync()
}

async function checkSession(): Promise<void> {
  try {
    await api.session()
    useSync.setState({ status: 'idle' })
  } catch (err) {
    useSync.setState(statusFor(err))
  }
}

export async function login(password: string): Promise<void> {
  await api.login(password)
  useSync.setState({ status: 'idle', error: undefined })
  await sync()
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } finally {
    localStorage.removeItem(CURSOR_KEY)
    useSync.setState({ status: 'signed-out' })
  }
}

/** One round trip. Coalesces: a call while one is in flight runs once more afterwards. */
export async function sync(): Promise<void> {
  const { status } = useSync.getState()
  if (status === 'signed-out' || status === 'unknown') return
  if (!navigator.onLine) {
    useSync.setState({ status: 'offline' })
    return
  }
  if (inFlight) {
    runAgain = true
    return
  }
  inFlight = true
  clearTimeout(timer)
  useSync.setState({ status: 'syncing' })

  try {
    const local = currentSnapshot()
    const pushed = new Set(local.tombstones.map((t) => `${t.kind}:${t.id}:${t.deletedAt}`))
    const res = await api.sync({ since: readCursor(), rows: toRows(local) })

    const merged = applyRemote(currentSnapshot(), res.rows)
    // The server now has every tombstone we sent; only ones created meanwhile stay.
    merged.tombstones = merged.tombstones.filter((t) => !pushed.has(`${t.kind}:${t.id}:${t.deletedAt}`))

    applying = true
    try {
      applySnapshot(merged)
    } finally {
      applying = false
    }
    writeCursor(res.cursor)
    useSync.setState({ status: 'idle', lastSyncedAt: new Date().toISOString(), error: undefined })
  } catch (err) {
    useSync.setState(statusFor(err))
  } finally {
    inFlight = false
    if (runAgain) {
      runAgain = false
      void sync()
    }
  }
}

function statusFor(err: unknown): { status: SyncStatusFromError; error?: string } {
  if (err instanceof ApiError) {
    if (err.status === 401) return { status: 'signed-out' }
    return { status: 'error', error: `${err.status} ${err.message}` }
  }
  return { status: 'offline' }
}
type SyncStatusFromError = 'signed-out' | 'error' | 'offline'

function readCursor(): number {
  try {
    const raw = localStorage.getItem(CURSOR_KEY)
    const n = raw ? Number(JSON.parse(raw).cursor) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeCursor(cursor: number): void {
  try {
    localStorage.setItem(CURSOR_KEY, JSON.stringify({ cursor }))
  } catch {
    // Without a cursor the next sync pulls everything again — correct, just slower.
  }
}
