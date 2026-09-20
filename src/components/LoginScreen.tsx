import { useState, type FormEvent } from 'react'
import { login } from '../sync/engine'
import { ApiError } from '../sync/client'
import { Button, field } from './ui'

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
        <div className="text-2xl font-semibold tracking-tight">Brian Tasks</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className={field}
        />
        {error && <div className="text-sm text-danger">{error}</div>}
        <Button type="submit" disabled={busy || password.length === 0} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
