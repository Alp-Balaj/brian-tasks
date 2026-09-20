import { useEffect, useState } from 'react'
import { toISODate } from './dates'

/** Today's ISO date, re-checked every minute so an open tab rolls over at midnight (Q11). */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = toISODate(new Date())
      setToday((prev) => (prev === next ? prev : next))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return today
}
