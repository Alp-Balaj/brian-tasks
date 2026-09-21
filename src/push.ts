// The Device's side of notifications (PD-17): opt in (browser permission, a push
// subscription, registered with the server together with this Device's timezone) and
// opt out. Nothing here runs unless the user taps the bell.
import { ApiError } from './sync/client'

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on'

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** The app's service worker, or null when none is registered (the dev server has none). `ready` would wait forever. */
const registration = (): Promise<ServiceWorkerRegistration | undefined> => navigator.serviceWorker.getRegistration()

/** Where this Device stands. `unavailable` = the server has no keys, or no worker is registered. */
export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const [key, reg] = await Promise.all([serverKey().catch(() => null), registration()])
  if (key === null || !reg) return 'unavailable'
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

async function serverKey(): Promise<string | null> {
  const res = await fetch('/api/push/key', { credentials: 'same-origin' })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return ((await res.json()) as { key: string | null }).key
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  const key = await serverKey()
  if (key === null) return 'unavailable'
  const reg = await registration()
  if (!reg) return 'unavailable'
  if ((await Notification.requestPermission()) !== 'granted') return 'denied'
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }))
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub) return 'off'
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe()
  return 'off'
}

/** VAPID public key (base64url) to the bytes PushManager wants. */
function toBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
