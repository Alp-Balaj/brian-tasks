// Brian Tasks server: serves the built app from dist/ and the sync API under /api.
// Run with `node server/index.ts` (Node 24 strips the types itself).
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { migrate, pool, sync, type Row } from './db.ts'
import { mcpApp } from './mcp.ts'
import { migratePush, pushApp, startPushTick } from './push.ts'
import { pgRecords } from './records.ts'
import {
  clearFailures,
  endSession,
  hasSession,
  loginAllowed,
  noteFailure,
  passwordMatches,
  requireSession,
  startSession,
} from './auth.ts'

const app = new Hono()
const api = new Hono()

api.get('/health', async (c) => {
  await pool.query('SELECT 1')
  return c.text('ok')
})

api.post('/login', async (c) => {
  const address = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local'
  if (!loginAllowed(address)) return c.text('Too many attempts, try again in a minute', 429)
  const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown })
  if (typeof body.password !== 'string' || !passwordMatches(body.password)) {
    noteFailure(address)
    return c.text('Wrong password', 401)
  }
  clearFailures(address)
  await startSession(c)
  return c.body(null, 204)
})

api.post('/logout', (c) => {
  endSession(c)
  return c.body(null, 204)
})

api.get('/session', async (c) => (await hasSession(c)) ? c.body(null, 204) : c.text('Sign in first', 401))

api.post('/sync', requireSession, async (c) => {
  const body = await c.req.json<{ since?: unknown; rows?: unknown }>().catch(() => null)
  if (!body || !Array.isArray(body.rows) || !body.rows.every(isRow)) return c.text('Bad request', 400)
  const since = typeof body.since === 'number' && Number.isFinite(body.since) ? body.since : 0
  return c.json(await sync(since, body.rows))
})

// Claude (Code, Cowork, chat) talks to Brian here; its own token, not the cookie.
api.route('/mcp', mcpApp(pgRecords))
// A Device opts in to notifications here (PD-17); the cookie guards it.
api.route('/push', pushApp())

api.onError((err, c) => {
  console.error(err)
  return c.text('Server error', 500)
})
app.route('/api', api)
app.all('/api/*', (c) => c.text('Not found', 404))
// MCP clients probe these for OAuth before connecting. A 404 says "no OAuth here,
// use the token"; the index.html fallback below would answer with HTML instead.
app.all('/.well-known/*', (c) => c.text('Not found', 404))

// The app itself. Hashed assets are immutable; everything else must revalidate so
// a new deploy (and its service worker) is picked up on the next open.
app.use(
  '/assets/*',
  async (c, next) => {
    await next()
    c.header('cache-control', 'public, max-age=31536000, immutable')
  },
  serveStatic({ root: './dist' }),
)
app.use('*', async (c, next) => {
  await next()
  if (!c.res.headers.has('cache-control')) c.header('cache-control', 'no-cache')
})
app.use('*', serveStatic({ root: './dist' }))
// Client-side routes (/board, /calendar, ...) all load index.html.
app.get('*', serveStatic({ root: './dist', path: 'index.html' }))

const KINDS = new Set(['task', 'space', 'routine', 'checkin', 'block', 'placement'])
function isRow(v: unknown): v is Row {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.kind === 'string' &&
    KINDS.has(r.kind) &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.id.length <= 200 &&
    typeof r.updatedAt === 'string' &&
    typeof r.deleted === 'boolean'
  )
}

const port = Number(process.env.PORT ?? 3000)
await migrate()
await migratePush()
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`brian-tasks listening on :${port}`)
  console.log(startPushTick(pgRecords) ? 'push notifications on' : 'push notifications off (no VAPID keys)')
})
