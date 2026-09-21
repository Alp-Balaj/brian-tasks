/// <reference lib="webworker" />
// The service worker (E8): precaches the app shell exactly as vite-plugin-pwa's
// generated worker did, leaves /api alone, and shows the two notifications the
// server sends (PD-18). Data never goes through here.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Client-side routes load the shell; the API is never answered from cache.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

// autoUpdate: a new worker takes over as soon as it is installed.
self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

interface Payload {
  title: string
  body: string
  url: string
  key: string
}

self.addEventListener('push', (event) => {
  let payload: Payload | undefined
  try {
    payload = event.data?.json() as Payload
  } catch {
    return
  }
  if (!payload?.title) return
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.key,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url },
    }),
  )
})

// A tap opens Home in the app if it is already open, else opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string })?.url ?? '/home', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const open = clients.find((c) => 'focus' in c)
      if (open) {
        await open.focus()
        if ('navigate' in open) await open.navigate(url).catch(() => {})
        return
      }
      await self.clients.openWindow(url)
    }),
  )
})
