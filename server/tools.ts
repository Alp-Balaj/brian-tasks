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
import {
  DEFAULT_SPACE_ID,
  defaultSpace,
  nextFreeColour,
  SPACE_COLOUR_NAMES,
  type Space,
  type SpaceColourName,
} from '../src/domain/space.ts'
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
import {
  appliesTo,
  BLOCK_COLOUR_NAMES,
  blockNames,
  blocksInWeek,
  blocksOn,
  buildBlock,
  carries,
  currentBlock,
  dateInWeek,
  DAY,
  describeMinutes,
  isTimed,
  movePlacements,
  nextFreeBlockColour,
  nextWeek,
  placementsIn,
  placementsOn,
  removePlacementsOf,
  repointPlacements,
  scheduledFromPlacements,
  snap,
  splitAt,
  touchedTasks,
  unlinkPlacements,
  weekdayOf,
  weekOf,
  type Block,
  type BlockColourName,
  type Minutes,
  type Placement,
  type PlacementChange,
  type WeekKey,
} from '../src/domain/block.ts'
import { WEEKDAY_SHORT, WEEKDAYS_MONDAY_FIRST, type Weekday } from '../src/domain/routine.ts'
import { toISODate } from '../src/lib/dates.ts'
import type { Records } from './records.ts'
import type { Row } from './db.ts'

export const INSTRUCTIONS = `Brian Tasks is a single-person task manager.
Vocabulary: a Task has a Status (todo, in-progress, hold, done), a Priority (low, normal, high, urgent), optional Tags, an optional Due date (hard deadline) and Scheduled date (the day to work on it), and lives in exactly one Space (Personal, Work, ...). A Pinned Task shows on Home. Archived Tasks are hidden everywhere but the Archive. A Routine is something done repeatedly on a schedule; it is never finished, only checked in for a day. A Block is a named, coloured span of one day on the Week page (Job 09:00–17:00); a standing Block carries to every following week, a one-off Block is for its week only. Blocks can be listed, created, changed and deleted here; a change to a standing Block applies from a week on and past weeks keep what they had. A Placement is a Task put on a specific day, inside a Block and/or at an hour; \`today\` reports them, nothing here changes them.
Dates are calendar dates, YYYY-MM-DD, in the user's local time; times are HH:MM. Start with \`today\` to see what matters right now. Deleting a Task, Routine, Space or Block is permanent and the app only offers it from the Archive: prefer archiving (update_task archived: true) unless the user asks to delete, and say what will go before deleting. Personal, the default Space, can never be deleted; deleting another Space moves its Tasks to Personal.`

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
const blockColourNames = Object.keys(BLOCK_COLOUR_NAMES) as [BlockColourName, ...BlockColourName[]]
const blockColour = z.enum(blockColourNames).describe(`Palette colour: ${blockColourNames.join(', ')}`)
const clockTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Expected a time of day, HH:MM')
  .describe('Time of day, HH:MM (24h, up to 24:00); snapped to 15 minutes')
const weekdayNames = WEEKDAYS_MONDAY_FIRST.map((d) => WEEKDAY_SHORT[d].toLowerCase()) as [string, ...string[]]
const weekday = z.enum(weekdayNames).describe('Day of the week: mon … sun')
const routineRefs = z.array(z.string()).describe('Routine titles (case-insensitive) or ids')

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

  const spaceView = (s: Space) => ({ id: s.id, name: s.name, colour: paletteName(SPACE_COLOUR_NAMES, s.colour) })

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

  /** `at`: the earliest Block on `date` that links the Routine (TB-20), when `blocks` are that day's. */
  const routineView = (r: Routine, date: ISODate, blocks: Block[] = []) => {
    const at = blocks.find((b) => b.routineIds.includes(r.id))
    return {
      id: r.id,
      title: r.title,
      schedule: describeSchedule(r.schedule),
      scheduledToday: isScheduledOn(r.schedule, localDate(date)),
      done: r.checkIns.includes(date),
      streak: currentStreak(r, localDate(date)),
      ...(r.note && { note: r.note }),
      ...(r.archived && { archived: true }),
      ...(at && { at: describeMinutes(at.start) }),
    }
  }

  /**
   * Today's Blocks and Placements as Home's strip shows them (TB-20, TB-23): the Blocks
   * on `date` with their linked Routines and Tasks, then timed Placements outside any of
   * those Blocks. A placed Task that is done or archived stays listed (TB-16).
   */
  const dayView = (
    date: ISODate,
    blocks: Block[],
    placements: Placement[],
    tasks: Task[],
    routines: Routine[],
    view: ReturnType<typeof taskView>,
  ) => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const titles = new Map(routines.map((r) => [r.id, r.title]))
    const placed = (p: Placement) => {
      const task = byId.get(p.taskId)
      return task && { ...view(task), ...(isTimed(p) && { start: describeMinutes(p.start), end: describeMinutes(p.end) }) }
    }
    const inBlocks = new Set(blocks.map((b) => b.id))
    return {
      blocks: blocks.map((b) => ({
        name: b.name,
        start: describeMinutes(b.start),
        end: describeMinutes(b.end),
        routines: b.routineIds.map((id) => titles.get(id)).filter((t) => t !== undefined),
        tasks: placementsIn(placements, b, date).map(placed).filter((t) => t !== undefined),
      })),
      placements: placementsOn(placements, date)
        .filter((p) => isTimed(p) && (p.blockId === undefined || !inBlocks.has(p.blockId)))
        .map(placed)
        .filter((t) => t !== undefined),
    }
  }

  /** Minutes since midnight on the server's clock, in its local time (ADR 0002: TZ decides). */
  const nowMinutes = (): Minutes => {
    const at = clock()
    return at.getHours() * 60 + at.getMinutes()
  }

  server.registerTool(
    'today',
    {
      title: 'Today',
      description:
        "What Home shows: today's Blocks (with their linked Routines and placed Tasks), timed Placements outside them, the Block under way right now, overdue Tasks, today's Routines with their Check-in state, Tasks due or scheduled today, Pinned Tasks, and Tasks in progress. Each Task appears once in the sections, in the first it qualifies for. The right first call.",
      inputSchema: { date: isoDate.optional().describe('Defaults to today') },
      annotations: { readOnlyHint: true },
    },
    async ({ date = today() }) => {
      const [tasks, spaces, routines, allBlocks, placements] = await Promise.all([
        records.tasks(),
        spaceList(),
        routineList(),
        records.blocks(),
        records.placements(),
      ])
      const view = taskView(spaces)
      const sections = homeSections(tasks, date)
      const blocks = blocksOn(allBlocks, date)
      // `now` needs the clock, so it only means something on the clock's today.
      const current = date === today() ? currentBlock(allBlocks, date, nowMinutes()) : undefined
      return ok({
        date,
        ...(date === today() && { now: current ? { name: current.name, until: describeMinutes(current.end) } : null }),
        ...dayView(date, blocks, placements, tasks, routines, view),
        routines: routines
          .filter((r) => !r.archived && isScheduledOn(r.schedule, localDate(date)))
          .map((r) => routineView(r, date, blocks)),
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
    'delete_task',
    {
      title: 'Delete Task',
      description:
        'Permanently delete a Task and its Placements on the Week page. This cannot be undone; the app only offers it from the Archive. Unless the user asks to delete, prefer update_task with archived: true, which hides the Task but keeps it.',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      const [tasks, placements] = await Promise.all([records.tasks(), records.placements()])
      const task = tasks.find((t) => t.id === id)
      if (!task) return fail(`No Task with id ${id}`)
      const ts = now()
      const placed = placements.filter((p) => p.taskId === id)
      await records.put([tombstone('task', id, ts), ...placed.map((p) => tombstone('placement', p.id, ts))])
      return ok({ id, title: task.title, deleted: true, ...(placed.length > 0 && { placementsRemoved: placed.length }) })
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
      description: 'Rename or recolour a Space.',
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
    'delete_space',
    {
      title: 'Delete Space',
      description:
        'Delete a Space. Its Tasks (archived ones included) move to Personal, which can never be deleted. This cannot be undone.',
      inputSchema: { space: spaceRef },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ space: ref }) => {
      const [tasks, spaces] = await Promise.all([records.tasks(), spaceList()])
      const space = findSpace(spaces, ref)
      if (!space) return noSpace(ref, spaces)
      if (space.id === DEFAULT_SPACE_ID) return fail(`"${space.name}" is the default Space and cannot be deleted`)
      const ts = now()
      // Q16 as the app does it: the Tasks are re-homed, not deleted with the Space.
      const moved = tasks.filter((t) => t.spaceId === space.id).map((t) => applyPatch(t, { spaceId: DEFAULT_SPACE_ID }, ts))
      await records.put([tombstone('space', space.id, ts), ...moved.map((t) => live('task', t))])
      return ok({ id: space.id, name: space.name, deleted: true, ...(moved.length > 0 && { tasksMoved: moved.length }) })
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
      await records.put([tombstone('checkin', checkInId(routine.id, date), now())])
      const without: Routine = { ...routine, checkIns: routine.checkIns.filter((d) => d !== date) }
      return ok(routineView(without, date))
    },
  )

  server.registerTool(
    'delete_routine',
    {
      title: 'Delete Routine',
      description:
        'Permanently delete a Routine and every Check-in it ever had. Blocks that listed it simply stop listing it. This cannot be undone; the app only offers it from the Archive.',
      inputSchema: { routine: z.string().describe('Routine title (case-insensitive) or id') },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ routine: ref }) => {
      const routines = await routineList()
      const routine = findRoutine(routines, ref)
      if (!routine) return noRoutine(ref, routines)
      const ts = now()
      await records.put([
        tombstone('routine', routine.id, ts),
        ...routine.checkIns.map((date) => tombstone('checkin', checkInId(routine.id, date), ts)),
      ])
      return ok({
        id: routine.id,
        title: routine.title,
        deleted: true,
        ...(routine.checkIns.length > 0 && { checkInsRemoved: routine.checkIns.length }),
      })
    },
  )

  // ---- Blocks -----------------------------------------------------------------------
  // The same operations as the app's store (src/store/blocks.ts), on records instead
  // of state: TB-5 splits, placement revisions and the Task's Scheduled (D9) come from
  // domain/block.ts, and one call writes every touched row once.

  const blockView = (routines: Routine[], week: WeekKey) => {
    const titles = new Map(routines.map((r) => [r.id, r.title]))
    return (b: Block) => ({
      id: b.id,
      name: b.name,
      colour: paletteName(BLOCK_COLOUR_NAMES, b.colour),
      day: WEEKDAY_SHORT[b.weekday],
      date: dateInWeek(week, b.weekday),
      start: describeMinutes(b.start),
      end: describeMinutes(b.end),
      carry: carries(b),
      ...(b.from > week && { from: b.from }),
      ...(!carries(b) && b.until !== nextWeek(week) && { until: b.until }),
      routines: b.routineIds.map((id) => titles.get(id)).filter((t) => t !== undefined),
    })
  }

  /** Routine refs to ids, or the first one that matches nothing. */
  const routineIds = (routines: Routine[], refs: string[]): { ids: string[] } | { error: CallToolResult } => {
    const ids: string[] = []
    for (const ref of refs) {
      const routine = findRoutine(routines, ref)
      if (!routine) return { error: noRoutine(ref, routines) }
      if (!ids.includes(routine.id)) ids.push(routine.id)
    }
    return { ids }
  }

  /** A span from two clock times, snapped to the grid (D5), or why it is not one. */
  const span = (start: string, end: string): { start: Minutes; end: Minutes } | { error: CallToolResult } => {
    const s = snap(parseMinutes(start))
    const e = snap(parseMinutes(end))
    if (s >= e) return { error: fail(`The Block must end after it starts (${describeMinutes(s)}–${describeMinutes(e)})`) }
    if (e > DAY) return { error: fail('A Block lives inside one day; it cannot end after 24:00 (TB-7)') }
    return { start: s, end: e }
  }

  /**
   * The rows one Block change comes to. Block versions and placements are gathered
   * by id so each is written once with its final shape (two rows for one key in one
   * put would tie on `updatedAt`); tasks whose Scheduled moved (D9) are added last.
   */
  const edit = (placements: Placement[], ts: string) => {
    const blocks = new Map<string, Block>()
    const changed = new Set<string>()
    const removed = new Map<string, Placement>()
    const touched = new Set<string>()
    const self = {
      placements,
      block(b: Block) {
        blocks.set(b.id, b)
      },
      apply(change: PlacementChange) {
        self.placements = change.placements
        for (const p of change.changed) changed.add(p.id)
        for (const p of change.removed) removed.set(p.id, p)
        for (const id of touchedTasks(change)) touched.add(id)
      },
      /** Scheduled follows the earliest placement left, never cleared (TB-17, D9). */
      rows(tasks: Task[], deletedBlocks: string[] = []): Row[] {
        const rows: Row[] = [...blocks.values()].map((b) => live('block', b))
        for (const id of deletedBlocks) rows.push(tombstone('block', id, ts))
        for (const p of self.placements) if (changed.has(p.id)) rows.push(live('placement', p))
        for (const id of removed.keys()) rows.push(tombstone('placement', id, ts))
        for (const id of touched) {
          const task = tasks.find((t) => t.id === id)
          if (!task) continue
          const next = scheduledFromPlacements(task, self.placements)
          if (next !== undefined && next !== task.scheduled) rows.push(live('task', applyPatch(task, { scheduled: next }, ts)))
        }
        return rows
      },
      counts: () => ({
        ...(changed.size > 0 && { placementsChanged: [...changed].filter((id) => !removed.has(id)).length }),
        ...(removed.size > 0 && { placementsRemoved: removed.size }),
      }),
    }
    return self
  }

  /**
   * TB-5, D8 as the store does it: the version a change from `week` on lands in — the
   * block itself when its rule starts in `week` or later, else the future half of a
   * split at `week`, with placements from `week` on re-pointed to it. Undefined when
   * the rule had already ended before `week`.
   */
  const versionFrom = (e: ReturnType<typeof edit>, block: Block, week: WeekKey, ts: string): Block | undefined => {
    if (block.from >= week) return block
    if (!appliesTo(block, week)) return undefined
    const { past, future } = splitAt(block, week, ts, nanoid(10))
    e.block(past)
    e.block(future)
    e.apply(repointPlacements(e.placements, block.id, future.id, week, ts))
    return future
  }

  const endedBefore = (block: Block, week: WeekKey, hint: string) =>
    fail(
      `Block "${block.name}" (${block.id}) had already ended before the week of ${week}: it ran from ${block.from} until ${block.until}. Either ${hint}, or list_blocks a week it is in force.`,
    )

  server.registerTool(
    'list_blocks',
    {
      title: 'List Blocks',
      description:
        'The Blocks in force in a week (this week unless told otherwise), Monday first, with their ids, colour, day, times, whether they carry to following weeks, and linked Routines. Use the ids with update_block and delete_block.',
      inputSchema: { week: isoDate.optional().describe('Any date in the week; defaults to today') },
      annotations: { readOnlyHint: true },
    },
    async ({ week: date = today() }) => {
      const [blocks, routines] = await Promise.all([records.blocks(), routineList()])
      const week = weekOf(date)
      const inForce = blocksInWeek(blocks, week)
      return ok({ week, count: inForce.length, blocks: inForce.map(blockView(routines, week)) })
    },
  )

  server.registerTool(
    'create_block',
    {
      title: 'Create Block',
      description:
        'Create a Block on a day: a named, coloured span of that day on the Week page. One-off (that week only) unless carry is true, which makes it standing: it carries to every following week. Blocks may overlap. The colour defaults to what other Blocks of that name use, else the first free palette colour.',
      inputSchema: {
        name: z.string().min(1),
        date: isoDate.describe('The day the Block is on; a standing Block starts in that week'),
        start: clockTime,
        end: clockTime,
        colour: blockColour.optional(),
        carry: z.boolean().optional().describe('Carry to every following week (standing). Default false'),
        routines: routineRefs.optional().describe('Routines done in this Block; they carry with it'),
      },
    },
    async ({ name, date, start, end, colour: chosen, carry, routines: refs }) => {
      const [blocks, routines] = await Promise.all([records.blocks(), routineList()])
      const times = span(start, end)
      if ('error' in times) return times.error
      const linked = routineIds(routines, refs ?? [])
      if ('error' in linked) return linked.error
      const trimmed = name.trim()
      const colour = chosen
        ? BLOCK_COLOUR_NAMES[chosen]
        : (blockNames(blocks).find((n) => n.name === trimmed)?.colour ?? nextFreeBlockColour(blocks))
      const week = weekOf(date)
      const block = buildBlock(
        { name: trimmed, colour, weekday: weekdayOf(date), ...times, week, carry, routineIds: linked.ids },
        nanoid(10),
        now(),
      )
      await records.put([live('block', block)])
      return ok(blockView(routines, week)(block))
    },
  )

  server.registerTool(
    'update_block',
    {
      title: 'Update Block',
      description:
        'Change a Block from a week on (this week unless told otherwise); earlier weeks keep what they had. Rename, recolour, move to another weekday (its placed Tasks move with it), change its times, turn carry on or off, or replace its linked Routines. A change to a standing Block that started earlier lands on a new version with a new id, returned here.',
      inputSchema: {
        id: z.string(),
        from: isoDate.optional().describe('Any date in the first week the change applies to; defaults to today'),
        name: z.string().min(1).optional(),
        colour: blockColour.optional(),
        weekday: weekday.optional(),
        start: clockTime.optional(),
        end: clockTime.optional(),
        carry: z.boolean().optional().describe('On: carries to every following week. Off: this is its last week'),
        routines: routineRefs.optional().describe('Replaces the whole list'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const [blocks, placements, tasks, routines] = await Promise.all([
        records.blocks(),
        records.placements(),
        records.tasks(),
        routineList(),
      ])
      const block = blocks.find((b) => b.id === args.id)
      if (!block) return fail(`No Block with id ${args.id}`)
      const linked = args.routines === undefined ? undefined : routineIds(routines, args.routines)
      if (linked && 'error' in linked) return linked.error
      const week = weekOf(args.from ?? today())
      const ts = now()
      const e = edit(placements, ts)
      const version = versionFrom(e, block, week, ts)
      if (!version) return endedBefore(block, week, 'pass a from date in a week it is in force')

      const times = span(args.start ?? describeMinutes(version.start), args.end ?? describeMinutes(version.end))
      if ('error' in times) return times.error
      const wanted = args.weekday === undefined ? version.weekday : weekdayFromName(args.weekday)
      const { until: _was, ...rest } = version
      const until = args.carry === undefined ? version.until : args.carry ? undefined : nextWeek(week)
      const next: Block = {
        ...rest,
        ...(args.name !== undefined && { name: args.name.trim() }),
        ...(args.colour !== undefined && { colour: BLOCK_COLOUR_NAMES[args.colour] }),
        weekday: wanted,
        ...times,
        ...(until === undefined ? {} : { until }),
        ...(linked && { routineIds: linked.ids }),
        updatedAt: ts,
      }
      e.block(next)
      if (wanted !== version.weekday) e.apply(movePlacements(e.placements, version.id, wanted, ts))
      // Carry turned off: what was in the Block in the weeks it no longer covers is unlinked.
      if (until !== undefined && until !== version.until) e.apply(unlinkPlacements(e.placements, version.id, ts, until))
      await records.put(e.rows(tasks))
      return ok({ ...blockView(routines, week)(next), ...e.counts() })
    },
  )

  server.registerTool(
    'delete_block',
    {
      title: 'Delete Block',
      description:
        'Remove a Block from a week on (this week unless told otherwise): it stops there, its placed Tasks from then on are removed, and earlier weeks keep it. A Block that starts in or after that week is deleted outright. Pass everywhere: true to delete the Block from past weeks too; then Tasks placed in it keep their hour if they had one and are otherwise removed.',
      inputSchema: {
        id: z.string(),
        from: isoDate.optional().describe('Any date in the first week the Block should be gone from; defaults to today'),
        everywhere: z.boolean().optional().describe('Delete outright, past weeks included'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ id, from, everywhere }) => {
      const [blocks, placements, tasks] = await Promise.all([records.blocks(), records.placements(), records.tasks()])
      const block = blocks.find((b) => b.id === id)
      if (!block) return fail(`No Block with id ${id}`)
      const ts = now()
      const e = edit(placements, ts)
      if (everywhere) {
        e.apply(unlinkPlacements(e.placements, id, ts))
        await records.put(e.rows(tasks, [id]))
        return ok({ id, name: block.name, deleted: true, ...e.counts() })
      }
      const week = weekOf(from ?? today())
      if (block.from < week && !appliesTo(block, week)) return endedBefore(block, week, 'pass everywhere: true to delete it from past weeks too')
      e.apply(removePlacementsOf(e.placements, id, week))
      if (block.from >= week) {
        await records.put(e.rows(tasks, [id]))
        return ok({ id, name: block.name, deleted: true, ...e.counts() })
      }
      e.block({ ...block, until: week, updatedAt: ts })
      await records.put(e.rows(tasks))
      return ok({ id, name: block.name, removedFrom: week, ...e.counts() })
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
const paletteName = (palette: Record<string, string>, hex: string): string =>
  Object.entries(palette).find(([, value]) => value === hex)?.[0] ?? hex

/** "17:30" → 1050. The schema has checked the shape. */
const parseMinutes = (time: string): Minutes => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "mon" … "sun" → the date-fns weekday number the domain uses. */
const weekdayFromName = (name: string): Weekday =>
  WEEKDAYS_MONDAY_FIRST[WEEKDAYS_MONDAY_FIRST.findIndex((d) => WEEKDAY_SHORT[d].toLowerCase() === name)]

/** A live row for a record, stamped with its own `updatedAt`. */
const live = (kind: string, data: { id: string; updatedAt: string }): Row => ({
  kind,
  id: data.id,
  updatedAt: data.updatedAt,
  deleted: false,
  data,
})

/** A tombstone for a record: the row every Device will bury it on. */
const tombstone = (kind: string, id: string, updatedAt: string): Row => ({ kind, id, updatedAt, deleted: true, data: null })

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })

const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] })

const noSpace = (ref: string, spaces: Space[]) =>
  fail(`No Space called "${ref}". Spaces: ${spaces.map((s) => s.name).join(', ')}`)

const noRoutine = (ref: string, routines: Routine[]) =>
  fail(`No Routine called "${ref}". Routines: ${routines.map((r) => r.title).join(', ') || '(none)'}`)
