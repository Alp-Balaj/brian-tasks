import { useEffect, useState } from 'react'
import type { Minutes } from '../domain/block'

const minutesNow = (): Minutes => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Minutes since local midnight, re-read every minute so the now-line on today's row
 * and Home's "Now ·" line keep moving in an open tab. Sibling of `useToday`: both
 * tick on the same cadence, so the date and the clock agree to within a minute.
 */
export function useNow(): Minutes {
  const [now, setNow] = useState(minutesNow)
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesNow()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
