import { useEffect, useState } from 'react'
import type { Minutes } from '../../domain/block'

const minutesNow = (): Minutes => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Minutes since local midnight, re-read every minute so the now-line on today's
 * row keeps moving in an open tab. Pairs with `useToday`, which handles the day.
 */
export function useNow(): Minutes {
  const [now, setNow] = useState(minutesNow)
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesNow()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
