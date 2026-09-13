import { describe, expect, it } from 'vitest'
import { currentStreak, describeSchedule, isMissed, isScheduledOn, type Routine, type Schedule } from './routine'

// Week used throughout: Mon 2026-09-07 … Sun 2026-09-13, next Mon 2026-09-14.
const MON = '2026-09-07'
const TUE = '2026-09-08'
const WED = '2026-09-09'
const THU = '2026-09-10'
const FRI = '2026-09-11'
const SAT = '2026-09-12'
const SUN = '2026-09-13'
const NEXT_MON = '2026-09-14'

const local = (iso: string) => new Date(`${iso}T12:00:00`)

const MWF: Schedule = { kind: 'weekdays', days: [1, 3, 5] }
const DAILY: Schedule = { kind: 'daily' }

const routine = (schedule: Schedule, checkIns: string[]): Routine => ({
  id: 'r',
  title: 'Read 20 pages',
  schedule,
  note: '',
  archived: false,
  checkIns: [...checkIns].sort(),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('isScheduledOn', () => {
  it('daily is every day', () => {
    expect(isScheduledOn(DAILY, local(SAT))).toBe(true)
  })
  it('weekdays checks the local weekday', () => {
    expect(isScheduledOn(MWF, local(MON))).toBe(true)
    expect(isScheduledOn(MWF, local(TUE))).toBe(false)
    expect(isScheduledOn(MWF, local(SUN))).toBe(false)
  })
  it('an empty weekday set is never scheduled', () => {
    expect(isScheduledOn({ kind: 'weekdays', days: [] }, local(MON))).toBe(false)
  })
})

describe('currentStreak — Mon/Wed/Fri example from the design agreement', () => {
  it('check-ins Mon+Wed, today Fri unchecked → 2', () => {
    expect(currentStreak(routine(MWF, [MON, WED]), local(FRI))).toBe(2)
  })
  it('check-ins Mon+Wed+Fri, today Fri → 3', () => {
    expect(currentStreak(routine(MWF, [MON, WED, FRI]), local(FRI))).toBe(3)
  })
  it('today Sat (off day) with Fri missed → 0', () => {
    expect(currentStreak(routine(MWF, [MON, WED]), local(SAT))).toBe(0)
  })
  it('today next Mon with Fri missed → 0', () => {
    expect(currentStreak(routine(MWF, [MON, WED]), local(NEXT_MON))).toBe(0)
  })
  it('today Sat (off day) with Fri checked → 3 (off days do not break it)', () => {
    expect(currentStreak(routine(MWF, [MON, WED, FRI]), local(SAT))).toBe(3)
  })
  it('today next Mon unchecked, Fri checked → 3 (today does not break it)', () => {
    expect(currentStreak(routine(MWF, [MON, WED, FRI]), local(NEXT_MON))).toBe(3)
  })
  it('a check-in on an off day neither extends nor breaks the streak', () => {
    expect(currentStreak(routine(MWF, [MON, TUE, WED]), local(WED))).toBe(2)
  })
})

describe('currentStreak — daily', () => {
  it('checked every day through yesterday → n', () => {
    const days = [MON, TUE, WED, THU, FRI, SAT]
    expect(currentStreak(routine(DAILY, days), local(SUN))).toBe(days.length)
  })
  it('checked every day through today → n', () => {
    const days = [MON, TUE, WED, THU]
    expect(currentStreak(routine(DAILY, days), local(THU))).toBe(days.length)
  })
  it('a gap two days ago → only what came after it', () => {
    expect(currentStreak(routine(DAILY, [MON, TUE, THU, FRI]), local(SAT))).toBe(2)
  })
  it('yesterday missed, today checked → 1', () => {
    expect(currentStreak(routine(DAILY, [MON, TUE, THU]), local(THU))).toBe(1)
  })
  it('no check-ins → 0', () => {
    expect(currentStreak(routine(DAILY, []), local(THU))).toBe(0)
  })
  it('never-scheduled routine → 0 and terminates', () => {
    expect(currentStreak(routine({ kind: 'weekdays', days: [] }, [MON]), local(FRI))).toBe(0)
  })
  it('stale check-ins far in the past do not count', () => {
    expect(currentStreak(routine(DAILY, ['2025-01-01']), local(THU))).toBe(0)
  })
})

describe('isMissed', () => {
  const r = routine(MWF, [MON])
  it('scheduled, past, unchecked → missed', () => {
    expect(isMissed(r, local(WED), local(FRI))).toBe(true)
  })
  it('scheduled, past, checked → not missed', () => {
    expect(isMissed(r, local(MON), local(FRI))).toBe(false)
  })
  it('unscheduled past day → not missed', () => {
    expect(isMissed(r, local(TUE), local(FRI))).toBe(false)
  })
  it('today is never missed', () => {
    expect(isMissed(r, local(FRI), local(FRI))).toBe(false)
  })
  it('the future is never missed', () => {
    expect(isMissed(r, local(NEXT_MON), local(FRI))).toBe(false)
  })
})

describe('describeSchedule', () => {
  it('lists days Monday first', () => {
    expect(describeSchedule({ kind: 'weekdays', days: [0, 5, 1] })).toBe('Mon, Fri, Sun')
  })
  it('all seven days reads as every day', () => {
    expect(describeSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day')
    expect(describeSchedule(DAILY)).toBe('Every day')
  })
  it('no days reads as never', () => {
    expect(describeSchedule({ kind: 'weekdays', days: [] })).toBe('Never')
  })
})
