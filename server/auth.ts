// One shared password, no accounts. A successful login sets a signed, HttpOnly
// cookie good for a year; every /api route except login and health requires it.
import { timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'

const COOKIE = 'brian_session'
const ONE_YEAR = 60 * 60 * 24 * 365

const env = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const passwordMatches = (candidate: string): boolean => {
  const expected = Buffer.from(env('APP_PASSWORD'))
  const given = Buffer.from(candidate)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

const secure = (c: Context) =>
  c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:'

export async function startSession(c: Context): Promise<void> {
  await setSignedCookie(c, COOKIE, String(Date.now()), env('SESSION_SECRET'), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secure(c),
    path: '/',
    maxAge: ONE_YEAR,
  })
}

export function endSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' })
}

export async function hasSession(c: Context): Promise<boolean> {
  const value = await getSignedCookie(c, env('SESSION_SECRET'), COOKIE)
  return typeof value === 'string' && value.length > 0
}

export const requireSession: MiddlewareHandler = async (c, next) => {
  if (!(await hasSession(c))) return c.text('Sign in first', 401)
  await next()
}

// Login attempts are throttled per address so the one password cannot be brute-forced.
const MAX_FAILURES = 5
const LOCKOUT_MS = 60_000
const failures = new Map<string, { count: number; until: number }>()

export function loginAllowed(address: string): boolean {
  const entry = failures.get(address)
  if (!entry) return true
  if (Date.now() > entry.until) {
    failures.delete(address)
    return true
  }
  return entry.count < MAX_FAILURES
}

export function noteFailure(address: string): void {
  const entry = failures.get(address) ?? { count: 0, until: 0 }
  failures.set(address, { count: entry.count + 1, until: Date.now() + LOCKOUT_MS })
}

export const clearFailures = (address: string): void => {
  failures.delete(address)
}
