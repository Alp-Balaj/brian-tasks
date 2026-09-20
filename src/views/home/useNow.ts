import { useEffect, useState } from 'react'
import type { Minutes } from '../../domain/block'

const minutesNow = (): Minutes => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Local minutes since midnight, re-read every minute for the now-line and the "Now ·"
 * line. Sibling of `useToday`: both tick on the same cadence, so the strip's date and
 * its clock agree to within a minute. (P6 may fold this into a shared hook with the
 * Week page's `useNow`.)
 */
export function useNow(): Minutes {
  const [now, setNow] = useState(minutesNow)
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesNow()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
