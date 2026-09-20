import { useState, type FormEvent } from 'react'
import { login } from '../sync/engine'
import { ApiError } from '../sync/client'

/**
 * Shown when this Device has no session. One shared password, no accounts.
 * Whatever is already in local storage stays untouched behind it.
 */
export function LoginScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong password.' : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <div className="text-lg font-semibold">Brian Tasks</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
