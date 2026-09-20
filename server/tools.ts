// The MCP tools: what Claude (Code, Cowork, chat) can see and do. Every tool speaks
// the app's vocabulary (CONTEXT.md), takes ids *or* names, and answers in compact
// JSON. Writes build records with the same domain functions the app uses, then go
// through Records.put, so a Task made from a chat is indistinguishable from one made
// in Quick Add. Nothing here touches Postgres directly; see records.ts.
import { z } from 'zod'
import { nanoid } from 'nanoid'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  applyPatch,
  buildTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ISODate,
  type Task,
  type TaskPatch,
  type TaskStatus,
} from '../src/domain/task.ts'
import { defaultSpace, nextFreeColour, SPACE_COLOUR_NAMES, type Space, type SpaceColourName } from '../src/domain/space.ts'
import {
  checkInId,
  currentStreak,
  describeSchedule,
  isScheduledOn,
  type CheckIn,
  type Routine,
  type RoutineRecord,
} from '../src/domain/routine.ts'
import { homeSections } from '../src/domain/home.ts'
import { toISODate } from '../src/lib/dates.ts'
import type { Records } from './records.ts'

export const INSTRUCTIONS = `Brian Tasks is a single-person task manager.
Vocabulary: a Task has a Status (todo, in-progress, hold, done), a Priority (low, normal, high, urgent), optional Tags, an optional Due date (hard deadline) and Scheduled date (the day to work on it), and lives in exactly one Space (Personal, Work, ...). A Pinned Task shows on Home. Archived Tasks are hidden everywhere but the Archive. A Routine is something done repeatedly on a schedule; it is never finished, only checked in for a day.
Dates are calendar dates, YYYY-MM-DD, in the user's local time. Start with \`today\` to see what matters right now. Tasks are never deleted from here: archive them instead. Spaces can be created and renamed here, never deleted.`

const STATUS_RANK: Record<TaskStatus, number> = { todo: 0, 'in-progress': 1, hold: 2, done: 3 }

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date, YYYY-MM-DD')
  .describe('Calendar date, YYYY-MM-DD')
const status = z.enum(TASK_STATUSES)
const priority = z.enum(TASK_PRIORITIES)
const tags = z.array(z.string().min(1)).describe('Free-form labels')
const spaceRef = z.string().describe('Space name (case-insensitive) or id')
const colourNames = Object.keys(SPACE_COLOUR_NAMES) as [SpaceColourName, ...SpaceColourName[]]
const colour = z.enum(colourNames).describe(`Palette colour: ${colourNames.join(', ')}`)

type Clock = () => Date

export function registerTools(server: McpServer, records: Records, clock: Clock = () => new Date()): void {
  const now = () => clock().toISOString()
  const today = () => toISODate(clock())

  const spaceList = async (): Promise<Space[]> => {
    const spaces = await records.spaces()
    if (!spaces.some((s) => s.id === defaultSpace().id)) spaces.push(defaultSpace())
    return spaces.sort((a, b) => a.order - b.order)
  }

  const spaceNamed = (spaces: Space[], name: string): Space | undefined => {
    const wanted = name.trim().toLowerCase()
    return spaces.find((s) => s.name.toLowerCase() === wanted)
  }

  const findSpace = (spaces: Space[], ref: string): Space | undefined =>
    spaces.find((s) => s.id === ref) ?? spaceNamed(spaces, ref)

  const spaceView = (s: Space) => ({ id: s.id, name: s.name, colour: colourName(s.colour) })

  const routineList = async (): Promise<Routine[]> => {
    const [routines, checkIns] = await Promise.all([records.routines(), records.checkIns()])
    return routines.map((r) => attach(r, checkIns))
  }

  const findRoutine = (routines: Routine[], ref: string): Routine | undefined => {
    const wanted = ref.trim().toLowerCase()
    const named = routines.filter((r) => r.title.toLowerCase() === wanted)
    return routines.find((r) => r.id === ref) ?? named.find((r) => !r.archived) ?? named[0]
  }

  const taskView = (spaces: Space[]) => {
    const names = new Map(spaces.map((s) => [s.id, s.name]))
    return (t: Task, full = false) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      space: names.get(t.spaceId) ?? t.spaceId,
      ...(t.due && { due: t.due }),
      ...(t.scheduled && { scheduled: t.scheduled }),
      ...(t.tags.length > 0 && { tags: t.tags }),
      ...(t.pinned && { pinned: true }),
      ...(t.archived && { archived: true }),
      ...((full || t.description) && { description: t.description }),
      ...(full && { createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt }),
    })
  }

  const routineView = (r: Routine, date: ISODate) => ({
    id: r.id,
    title: r.title,
    schedule: describeSchedule(r.schedule),
    scheduledToday: isScheduledOn(r.schedule, localDate(date)),
    done: r.checkIns.includes(date),
    streak: currentStreak(r, localDate(date)),
    ...(r.note && { note: r.note }),
    ...(r.archived && { archived: true }),
  })

  server.registerTool(
    'today',
    {
      title: 'Today',
      description:
        "What Home shows: overdue Tasks, today's Routines with their Check-in state, Tasks due or scheduled today, Pinned Tasks, and Tasks in progress. Each Task appears once, in the first section it qualifies for. The right first call.",
      inputSchema: { date: isoDate.optional().describe('Defaults to today') },
      annotations: { readOnlyHint: true },
    },
    async ({ date = today() }) => {
      const [tasks, spaces, routines] = await Promise.all([records.tasks(), spaceList(), routineList()])
      const view = taskView(spaces)
      const sections = homeSections(tasks, date)
      return ok({
        date,
        routines: routines
          .filter((r) => !r.archived && isScheduledOn(r.schedule, localDate(date)))
          .map((r) => routineView(r, date)),
        overdue: sections.overdue.map((t) => view(t)),
        today: sections.today.map(({ task, reason }) => ({ ...view(task), reason })),
        pinned: sections.pinned.map((t) => view(t)),
        inProgress: sections.inProgress.map((t) => view(t)),
      })
    },
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description: 'Tasks matching the filters. By default: every open (not done), non-archived Task in every Space.',
      inputSchema: {
        status: z.enum([...TASK_STATUSES, 'open', 'all']).optional().describe("Default 'open' = todo, in-progress, hold"),
        space: spaceRef.optional(),
        tag: z.string().optional(),
        search: z.string().optional().describe('Case-insensitive match on title and description'),
        due_by: isoDate.optional().describe('Only Tasks due on or before this date'),
        include_archived: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const [tasks, spaces] = await Promise.all([records.tasks(), spaceList()])
      let space: Space | undefined
      if (args.space) {
        space = findSpace(spaces, args.space)
        if (!space) return noSpace(args.space, spaces)
      }
      const wanted = args.status ?? 'open'
      const search = args.search?.trim().toLowerCase()
      const matching = tasks
        .filter((t) => args.include_archived || !t.archived)
        .filter((t) => (wanted === 'all' ? true : wanted === 'open' ? t.status !== 'done' : t.status === wanted))
        .filter((t) => !space || t.spaceId === space.id)
        .filter((t) => !args.tag || t.tags.includes(args.tag))
        .filter((t) => !args.due_by || (t.due !== undefined && t.due <= args.due_by))
        .filter((t) => !search || t.title.toLowerCase().includes(search) || t.description.toLowerCase().includes(search))
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.order - b.order)
      const view = taskView(spaces)
      return ok({ count: matching.length, tasks: matching.map((t) => view(t)) })
    },
  )

  server.registerTool(
    'get_task',
    {
      title: 'Get Task',
      description: 'One Task in full, including its description and timestamps.',
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const [tasks, spaces] = await Promise.all([records.tasks(), spaceList()])
      const task = tasks.find((t) => t.id === id)
      return task ? ok(taskView(spaces)(task, true)) : fail(`No Task with id ${id}`)
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a Task. Only the title is required; it goes to the top of the To do column in Personal unless told otherwise.',
      inputSchema: {
        title: z.string().min(1),
        description: z.string().optional(),
        status: status.optional(),
        priority: priority.optional(),
        tags: tags.optional(),
        due: isoDate.optional().describe('Hard deadline'),
        scheduled: isoDate.optional().describe('The day to work on it'),
        space: spaceRef.optional().describe('Defaults to Personal'),
        pinned: z.boolean().optional().describe('Show on Home'),
      },
    },
    async ({ space: ref, ...input }) => {
      const [tasks, spaces] = await Promise.all([records.tasks(), spaceList()])
      let spaceId: string | undefined
      if (ref) {
        const space = findSpace(spaces, ref)
        if (!space) return noSpace(ref, spaces)
        spaceId = space.id
      }
      const task = buildTask({ ...input, spaceId }, nanoid(10), tasks, now())
      await records.put([{ kind: 'task', id: task.id, updatedAt: task.updatedAt, deleted: false, data: task }])
      return ok(taskView(spaces)(task, true))
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description:
        'Change any fields of a Task. Set status to done to complete it; set archived to hide it. Pass null for due or scheduled to clear the date. Tags replace the whole list.',
      inputSchema: {
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: status.optional(),
        priority: priority.optional(),
        tags: tags.optional(),
        due: isoDate.nullable().optional(),
        scheduled: isoDate.nullable().optional(),
        space: spaceRef.optional(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const [tasks, spaces] = await Promise.all([records.tasks(), spaceList()])
      const task = tasks.find((t) => t.id === args.id)
      if (!task) return fail(`No Task with id ${args.id}`)
      const patch: TaskPatch = {}
      if (args.title !== undefined) patch.title = args.title.trim()
      if (args.description !== undefined) patch.description = args.description
      if (args.status !== undefined) patch.status = args.status
      if (args.priority !== undefined) patch.priority = args.priority
      if (args.tags !== undefined) patch.tags = args.tags
      if (args.due !== undefined) patch.due = args.due ?? undefined
      if (args.scheduled !== undefined) patch.scheduled = args.scheduled ?? undefined
      if (args.pinned !== undefined) patch.pinned = args.pinned
      if (args.archived !== undefined) patch.archived = args.archived
      if (args.space !== undefined) {
        const space = findSpace(spaces, args.space)
        if (!space) return noSpace(args.space, spaces)
        patch.spaceId = space.id
      }
      const next = applyPatch(task, patch, now())
      await records.put([{ kind: 'task', id: next.id, updatedAt: next.updatedAt, deleted: false, data: next }])
      return ok(taskView(spaces)(next, true))
    },
  )

  server.registerTool(
    'list_spaces',
    {
      title: 'List Spaces',
      description: 'The Spaces Tasks can live in, in switcher order.',
      annotations: { readOnlyHint: true },
    },
    async () => ok((await spaceList()).map(spaceView)),
  )

  server.registerTool(
    'create_space',
    {
      title: 'Create Space',
      description:
        'Create a Space for Tasks to live in. Goes to the bottom of the switcher. If a Space of that name already exists it is returned as is, so it is safe to call before filing Tasks into it.',
      inputSchema: {
        name: z.string().min(1),
        colour: colour.optional().describe('Defaults to the first palette colour no Space uses yet'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ name, colour: chosen }) => {
      const spaces = await spaceList()
      const existing = spaceNamed(spaces, name)
      if (existing) return ok({ ...spaceView(existing), alreadyExists: true })
      const space: Space = {
        id: nanoid(8),
        name: name.trim(),
        colour: chosen ? SPACE_COLOUR_NAMES[chosen] : nextFreeColour(spaces),
        order: Math.max(...spaces.map((s) => s.order)) + 1,
        updatedAt: now(),
      }
      await records.put([{ kind: 'space', id: space.id, updatedAt: space.updatedAt, deleted: false, data: space }])
      return ok(spaceView(space))
    },
  )

  server.registerTool(
    'update_space',
    {
      title: 'Update Space',
      description: 'Rename or recolour a Space. Spaces are never deleted from here; that stays in the app.',
      inputSchema: {
        space: spaceRef,
        name: z.string().min(1).optional(),
        colour: colour.optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ space: ref, name, colour: chosen }) => {
      const spaces = await spaceList()
      const space = findSpace(spaces, ref)
      if (!space) return noSpace(ref, spaces)
      if (name !== undefined) {
        const clash = spaceNamed(spaces, name)
        if (clash && clash.id !== space.id) return fail(`There is already a Space called "${clash.name}"`)
      }
      const next: Space = {
        ...space,
        ...(name !== undefined && { name: name.trim() }),
        ...(chosen !== undefined && { colour: SPACE_COLOUR_NAMES[chosen] }),
        updatedAt: now(),
      }
      await records.put([{ kind: 'space', id: next.id, updatedAt: next.updatedAt, deleted: false, data: next }])
      return ok(spaceView(next))
    },
  )

  server.registerTool(
    'list_routines',
    {
      title: 'List Routines',
      description: 'Every Routine with its schedule, whether it is scheduled and done today, and its current streak.',
      inputSchema: { include_archived: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ include_archived }) => {
      const date = today()
      const routines = (await routineList()).filter((r) => include_archived || !r.archived)
      return ok(routines.map((r) => routineView(r, date)))
    },
  )

  server.registerTool(
    'check_in',
    {
      title: 'Check in',
      description: 'Record that a Routine was done on a day (today unless told otherwise).',
      inputSchema: {
        routine: z.string().describe('Routine title (case-insensitive) or id'),
        date: isoDate.optional().describe('Defaults to today'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ routine: ref, date = today() }) => {
      const routines = await routineList()
      const routine = findRoutine(routines, ref)
      if (!routine) return noRoutine(ref, routines)
      if (routine.checkIns.includes(date)) return ok({ ...routineView(routine, date), alreadyDone: true })
      const ts = now()
      const checkIn: CheckIn = { routineId: routine.id, date, updatedAt: ts }
      await records.put([{ kind: 'checkin', id: checkInId(routine.id, date), updatedAt: ts, deleted: false, data: checkIn }])
      return ok(routineView(attach(routine, [checkIn]), date))
    },
  )

  server.registerTool(
    'uncheck',
    {
      title: 'Uncheck',
      description: "Remove a Routine's Check-in for a day (today unless told otherwise).",
      inputSchema: {
        routine: z.string().describe('Routine title (case-insensitive) or id'),
        date: isoDate.optional().describe('Defaults to today'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ routine: ref, date = today() }) => {
      const routines = await routineList()
      const routine = findRoutine(routines, ref)
      if (!routine) return noRoutine(ref, routines)
      if (!routine.checkIns.includes(date)) return ok({ ...routineView(routine, date), alreadyUnchecked: true })
      await records.put([{ kind: 'checkin', id: checkInId(routine.id, date), updatedAt: now(), deleted: true, data: null }])
      const without: Routine = { ...routine, checkIns: routine.checkIns.filter((d) => d !== date) }
      return ok(routineView(without, date))
    },
  )
}

// ---- Helpers ---------------------------------------------------------------------

/** A Routine with its Check-in days joined on, sorted and unique (the store's invariant). */
function attach(routine: RoutineRecord | Routine, checkIns: CheckIn[]): Routine {
  const existing = (routine as Routine).checkIns ?? []
  const days = checkIns.filter((c) => c.routineId === routine.id).map((c) => c.date)
  return { ...routine, checkIns: [...new Set([...existing, ...days])].sort() }
}

/** Midnight of an ISO date in the server's local time, for the weekday/streak functions. */
function localDate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The palette name for a hex colour, or the hex itself if it is off-palette. */
const colourName = (hex: string): string =>
  Object.entries(SPACE_COLOUR_NAMES).find(([, value]) => value === hex)?.[0] ?? hex

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })

const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] })

const noSpace = (ref: string, spaces: Space[]) =>
  fail(`No Space called "${ref}". Spaces: ${spaces.map((s) => s.name).join(', ')}`)

const noRoutine = (ref: string, routines: Routine[]) =>
  fail(`No Routine called "${ref}". Routines: ${routines.map((r) => r.title).join(', ') || '(none)'}`)
