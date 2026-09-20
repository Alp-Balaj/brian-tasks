import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

/** All days needed to render a month grid (padded to full weeks, Monday first). */
export function monthGrid(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
}

export const shiftMonth = (month: Date, delta: number) => startOfMonth(addMonths(month, delta))

/** Tomorrow's / yesterday's ISODate relative to `today`. */
export const shiftISODate = (iso: string, days: number) => toISODate(addDays(new Date(`${iso}T12:00:00`), days))

/**
 * Short human label for a calendar date next to `today`: "Today", "Tomorrow",
 * "Yesterday", "Wed 3 Sep" within the year, "3 Sep 2025" otherwise.
 */
export function formatDay(iso: string, today: string): string {
  if (iso === today) return 'Today'
  if (iso === shiftISODate(today, 1)) return 'Tomorrow'
  if (iso === shiftISODate(today, -1)) return 'Yesterday'
  const date = new Date(`${iso}T12:00:00`)
  return iso.slice(0, 4) === today.slice(0, 4) ? format(date, 'EEE d MMM') : format(date, 'd MMM yyyy')
}
