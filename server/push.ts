// Web Push (PD-17, PD-18, E7, E9): per-Device subscriptions in their own table, and
// a one-minute tick that tells each Device, in its own timezone, about a Placement at
// its hour and about the day at 08:00. Without VAPID keys nothing here runs and the
// routes answer 503, so a server without them behaves as before.
import webPush, { type PushSubscription } from 'web-push'
import { Hono } from 'hono'
import { pool } from './db.ts'
import { requireSession } from './auth.ts'
import type { Records } from './records.ts'
import { homeSections } from '../src/domain/home.ts'
import { blocksOn, describeMinutes, isTimed, placementsOn, type Block, type Minutes, type Placement } from '../src/domain/block.ts'
import type { ISODate, Task } from '../src/domain/task.ts'

export interface Notification {
  /** Stable per Device and event, so a Device is told once (E9). */
  key: string
  title: string
  body: string
  /** Where a tap goes. */
  url: string
}

export interface Subscription {
  endpoint: string
  subscription: PushSubscription
  tz: string
}

export const MORNING: Minutes = 8 * 60

/** The calendar date and minutes since midnight of `at` in `tz` (PD-17: the Device's zone decides). */
export function localClock(at: Date, tz: string): { date: ISODate; minutes: Minutes } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/**
 * PD-18: what one Device is told at one local minute. A timed Placement whose start is
 * now and whose Task is still open; and at 08:00, one line about the day when there is
 * anything to say. Pure, so the tick and its test agree.
 */
export function notificationsAt(
  tasks: readonly Task[],
  blocks: readonly Block[],
  placements: readonly Placement[],
  date: ISODate,
  minutes: Minutes,
): Notification[] {
  const out: Notification[] = []
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const dayBlocks = blocksOn(blocks, date)
  for (const p of placementsOn(placements, date)) {
    if (!isTimed(p) || p.start !== minutes) continue
    const task = byId.get(p.taskId)
    if (!task || task.status === 'done' || task.archived) continue
    const block = p.blockId ? dayBlocks.find((b) => b.id === p.blockId) : undefined
    out.push({
      key: `placement:${p.id}:${date}`,
      title: `${describeMinutes(p.start)} · ${task.title}`,
      body: block ? `in ${block.name} until ${describeMinutes(p.end)}` : `until ${describeMinutes(p.end)}`,
      url: '/home',
    })
  }
  if (minutes === MORNING) {
    const s = homeSections(tasks, date)
    const due = s.today.filter((r) => r.reason === 'due today').length
    const scheduled = s.today.length - due
    const parts = [due > 0 && `${due} due`, scheduled > 0 && `${scheduled} scheduled`, s.overdue.length > 0 && `${s.overdue.length} overdue`].filter(Boolean)
    if (parts.length > 0) out.push({ key: `morning:${date}`, title: 'Today', body: parts.join(' · '), url: '/home' })
  }
  return out
}

// ---- Subscriptions (E7) ------------------------------------------------------------

const configured = (): boolean => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

export async function migratePush(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint     text  PRIMARY KEY,
      subscription jsonb NOT NULL,
      tz           text  NOT NULL,
      created_at   text  NOT NULL
    );
  `)
}

async function subscriptions(): Promise<Subscription[]> {
  const res = await pool.query<{ endpoint: string; subscription: PushSubscription; tz: string }>(
    'SELECT endpoint, subscription, tz FROM push_subscriptions',
  )
  return res.rows
}

const forget = (endpoint: string) => pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])

/** The routes a Device uses to opt in and out (PD-17); the session cookie guards them. */
export function pushApp(): Hono {
  const app = new Hono()
  // `key: null` (not an error) when the server has no keys: the bell asks on every open.
  app.get('/key', (c) => c.json({ key: configured() ? process.env.VAPID_PUBLIC_KEY : null }))
  app.post('/subscribe', requireSession, async (c) => {
    if (!configured()) return c.text('Notifications are not set up on this server', 503)
    const body = await c.req.json<{ subscription?: PushSubscription; tz?: string }>().catch(() => null)
    const sub = body?.subscription
    if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) return c.text('Bad request', 400)
    const tz = typeof body?.tz === 'string' && validZone(body.tz) ? body.tz : 'UTC'
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, subscription, tz, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription, tz = EXCLUDED.tz`,
      [sub.endpoint, JSON.stringify(sub), tz, new Date().toISOString()],
    )
    return c.body(null, 204)
  })
  app.delete('/subscribe', requireSession, async (c) => {
    const body = await c.req.json<{ endpoint?: string }>().catch(() => null)
    if (typeof body?.endpoint !== 'string') return c.text('Bad request', 400)
    await forget(body.endpoint)
    return c.body(null, 204)
  })
  return app
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// ---- The tick (E9) ---------------------------------------------------------------

/** What has been sent, by Device and event; entries from past days are pruned as they are met. */
const sent = new Set<string>()

/** One pass: every Device, its local minute, what it is owed. Exported for the test; `send` is the delivery. */
export async function tick(
  records: Pick<Records, 'tasks' | 'blocks' | 'placements'>,
  subs: Subscription[],
  at: Date,
  send: (sub: Subscription, n: Notification) => Promise<void>,
): Promise<void> {
  if (subs.length === 0) return
  const [tasks, blocks, placements] = await Promise.all([records.tasks(), records.blocks(), records.placements()])
  for (const sub of subs) {
    const { date, minutes } = localClock(at, sub.tz)
    for (const n of notificationsAt(tasks, blocks, placements, date, minutes)) {
      const key = `${sub.endpoint}|${n.key}`
      if (sent.has(key)) continue
      sent.add(key)
      await send(sub, n)
    }
  }
  // Keys end with their local date; a day that is over everywhere on Earth can go.
  const over = localClock(at, 'Etc/GMT+12').date
  for (const key of sent) if (key.slice(-10) < over) sent.delete(key)
}

async function deliver(sub: Subscription, n: Notification): Promise<void> {
  try {
    await webPush.sendNotification(sub.subscription, JSON.stringify(n), { TTL: 600 })
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    // Gone: the browser dropped the subscription (the Device turned it off, or was reset).
    if (status === 404 || status === 410) await forget(sub.endpoint)
    else console.error('push failed', status ?? err)
  }
}

/** Start the minute tick if the keys are set. Returns whether it started. */
export function startPushTick(records: Records): boolean {
  if (!configured()) return false
  webPush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:brian@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  const each = async () => {
    const subs = await subscriptions().catch(() => [] as Subscription[])
    await tick(records, subs, new Date(), deliver)
  }
  // Align to the top of the next minute, then every minute; a run that overlaps is skipped.
  let running = false
  const step = () => {
    if (running) return
    running = true
    each()
      .catch((err) => console.error('push tick failed', err))
      .finally(() => {
        running = false
      })
  }
  setTimeout(() => {
    step()
    setInterval(step, 60_000)
  }, 60_000 - (Date.now() % 60_000))
  return true
}
