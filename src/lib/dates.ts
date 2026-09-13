import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

/** All days needed to render a month grid (padded to full weeks, Monday first). */
export function monthGrid(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
}

export const shiftMonth = (month: Date, delta: number) => startOfMonth(addMonths(month, delta))
