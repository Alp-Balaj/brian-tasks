// The only file that knows the HTTP shape of the server. See server/index.ts for the other side.
import type { SyncRow } from './merge'

export interface SyncRequest {
  /** Server cursor from the last successful sync; 0 on a fresh Device. */
  since: number
  rows: SyncRow[]
}

export interface SyncResponse {
  cursor: number
  rows: SyncRow[]
}

/** Thrown for every non-2xx reply; `status` 401 means "no session". */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')) || res.statusText)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const api = {
  /** 204 when this Device holds a valid session, 401 otherwise. */
  session: () => call<void>('session'),
  login: (password: string) => call<void>('login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<void>('logout', { method: 'POST' }),
  sync: (body: SyncRequest) => call<SyncResponse>('sync', { method: 'POST', body: JSON.stringify(body) }),
}
