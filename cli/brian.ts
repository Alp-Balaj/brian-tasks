#!/usr/bin/env node
// brian — Brian Tasks from the terminal. A thin MCP client of the server's
// /api/mcp endpoint, so it can do exactly what Claude can do, nothing more.
// Node 24 runs this file as-is. Config: BRIAN_URL + BRIAN_TOKEN, or
// `brian config <url> <token>` (saved to ~/.config/brian-tasks/config.json).
import { parseArgs } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const CONFIG_PATH = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'brian-tasks', 'config.json')

const HELP = `brian — Brian Tasks from the terminal

  brian today                         what Home shows
  brian ls [filters]                  open tasks (--status todo|in-progress|hold|done|open|all,
                                      --space X, --tag T, --search Q, --due-by DATE, --archived)
  brian show <id>                     one task in full
  brian add <title> [fields]          --space X --due DATE --scheduled DATE --priority P
                                      --tags a,b --status S --pin --desc TEXT
  brian edit <id> [fields]            same fields, plus --title T, --no-due, --no-scheduled,
                                      --unpin, --archive, --restore
  brian done|start|hold|todo <id>     change status
  brian spaces                        the Spaces
  brian routines                      the Routines and today's state
  brian check <routine> [--date D]    check in (today unless told)
  brian uncheck <routine> [--date D]
  brian tools                         every tool the server offers
  brian call <tool> [json]            call any tool directly
  brian config <url> <token>          save the server URL and MCP token

  --json on any command prints the raw reply. Dates are YYYY-MM-DD.`

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    status: { type: 'string' },
    space: { type: 'string' },
    tag: { type: 'string' },
    tags: { type: 'string' },
    search: { type: 'string' },
    'due-by': { type: 'string' },
    archived: { type: 'boolean' },
    title: { type: 'string' },
    desc: { type: 'string' },
    due: { type: 'string' },
    'no-due': { type: 'boolean' },
    scheduled: { type: 'string' },
    'no-scheduled': { type: 'boolean' },
    priority: { type: 'string' },
    pin: { type: 'boolean' },
    unpin: { type: 'boolean' },
    archive: { type: 'boolean' },
    restore: { type: 'boolean' },
    date: { type: 'string' },
  },
})

const [command, ...rest] = positionals

async function main(): Promise<void> {
  if (!command || flags.help) return console.log(HELP)
  if (command === 'config') return saveConfig(rest[0], rest[1])

  const client = await connect()
  try {
    switch (command) {
      case 'today':
        return print(await call(client, 'today', flags.date ? { date: flags.date } : {}), printToday)
      case 'ls':
        return print(
          await call(client, 'list_tasks', {
            status: flags.status,
            space: flags.space,
            tag: flags.tag,
            search: flags.search,
            due_by: flags['due-by'],
            include_archived: flags.archived,
          }),
          (d: { tasks: TaskView[] }) => printTasks(d.tasks),
        )
      case 'show':
        return print(await call(client, 'get_task', { id: need(rest[0], 'id') }), printFull)
      case 'add':
        return print(
          await call(client, 'create_task', { ...taskFields(), title: need(rest.join(' '), 'title') }),
          printFull,
        )
      case 'edit':
        return print(await call(client, 'update_task', { id: need(rest[0], 'id'), ...taskFields() }), printFull)
      case 'done':
      case 'start':
      case 'hold':
      case 'todo': {
        const status = { done: 'done', start: 'in-progress', hold: 'hold', todo: 'todo' }[command]
        return print(await call(client, 'update_task', { id: need(rest[0], 'id'), status }), printFull)
      }
      case 'spaces':
        return print(await call(client, 'list_spaces'), (d: { id: string; name: string }[]) =>
          d.forEach((s) => console.log(`${s.id.padEnd(10)} ${s.name}`)),
        )
      case 'routines':
        return print(await call(client, 'list_routines', { include_archived: flags.archived }), printRoutines)
      case 'check':
      case 'uncheck':
        return print(
          await call(client, command === 'check' ? 'check_in' : 'uncheck', {
            routine: need(rest.join(' '), 'routine'),
            date: flags.date,
          }),
          (r: RoutineView) => printRoutines([r]),
        )
      case 'tools': {
        const { tools } = await client.listTools()
        for (const t of tools) console.log(`${t.name.padEnd(14)} ${t.description ?? ''}`)
        return
      }
      case 'call':
        return print(await call(client, need(rest[0], 'tool'), rest[1] ? JSON.parse(rest[1]) : {}), (d) =>
          console.log(JSON.stringify(d, null, 2)),
        )
      default:
        throw new Error(`Unknown command "${command}". Try brian --help`)
    }
  } finally {
    await client.close()
  }
}

// ---- Talking to the server --------------------------------------------------------

async function connect(): Promise<Client> {
  const { url, token } = await loadConfig()
  const transport = new StreamableHTTPClientTransport(new URL('/api/mcp', url), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  })
  const client = new Client({ name: 'brian-cli', version: '1.0.0' })
  await client.connect(transport)
  return client
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined))
  const res = (await client.callTool({ name, arguments: clean })) as CallToolResult
  const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
  if (res.isError) throw new Error(text)
  return JSON.parse(text)
}

async function loadConfig(): Promise<{ url: string; token: string }> {
  let saved: Partial<{ url: string; token: string }> = {}
  try {
    saved = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    // No file yet: the environment must have it.
  }
  const url = process.env.BRIAN_URL ?? saved.url
  const token = process.env.BRIAN_TOKEN ?? saved.token
  if (!url || !token) throw new Error(`Not configured. Run: brian config <url> <token>  (or set BRIAN_URL and BRIAN_TOKEN)`)
  return { url, token }
}

async function saveConfig(url: string | undefined, token: string | undefined): Promise<void> {
  if (!url || !token) throw new Error('Usage: brian config <url> <token>')
  new URL(url) // throws on garbage
  await mkdir(join(CONFIG_PATH, '..'), { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify({ url, token }, null, 2) + '\n', { mode: 0o600 })
  console.log(`Saved to ${CONFIG_PATH}`)
}

// ---- Arguments ----------------------------------------------------------------------

function need(value: string | undefined, what: string): string {
  if (!value) throw new Error(`Missing ${what}. Try brian --help`)
  return value
}

/** The task fields `add` and `edit` share, from the flags. Only what was given. */
function taskFields(): Record<string, unknown> {
  const f: Record<string, unknown> = {
    title: flags.title,
    description: flags.desc,
    status: flags.status,
    priority: flags.priority,
    space: flags.space,
    due: flags['no-due'] ? null : flags.due,
    scheduled: flags['no-scheduled'] ? null : flags.scheduled,
  }
  if (flags.tags !== undefined) f.tags = flags.tags.split(',').map((t) => t.trim()).filter(Boolean)
  if (flags.pin) f.pinned = true
  if (flags.unpin) f.pinned = false
  if (flags.archive) f.archived = true
  if (flags.restore) f.archived = false
  return f
}

// ---- Printing -----------------------------------------------------------------------

interface TaskView {
  id: string
  title: string
  status: string
  priority: string
  space: string
  due?: string
  scheduled?: string
  tags?: string[]
  pinned?: boolean
  archived?: boolean
  description?: string
  reason?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}

interface RoutineView {
  id: string
  title: string
  schedule: string
  scheduledToday: boolean
  done: boolean
  streak: number
  note?: string
  archived?: boolean
}

function print<T>(data: unknown, fn: (d: T) => void): void {
  if (flags.json) console.log(JSON.stringify(data, null, 2))
  else fn(data as T)
}

const PRIORITY_MARK: Record<string, string> = { urgent: '!!!', high: '!! ', normal: '   ', low: ' . ' }

function taskLine(t: TaskView): string {
  const bits = [
    t.id.padEnd(10),
    `[${t.status}]`.padEnd(14),
    PRIORITY_MARK[t.priority] ?? '   ',
    t.title,
    `(${t.space})`,
    t.due && `due ${t.due}`,
    t.scheduled && `on ${t.scheduled}`,
    t.tags?.length && t.tags.map((x) => `#${x}`).join(' '),
    t.pinned && '*pinned*',
    t.archived && '(archived)',
    t.reason && `<${t.reason}>`,
  ]
  return bits.filter(Boolean).join(' ')
}

function printTasks(tasks: TaskView[]): void {
  if (tasks.length === 0) return console.log('(nothing)')
  for (const t of tasks) console.log(taskLine(t))
}

function printFull(t: TaskView): void {
  console.log(taskLine(t))
  if (t.description) console.log(`\n${t.description}\n`)
  const stamps = [t.createdAt && `created ${t.createdAt}`, t.completedAt && `completed ${t.completedAt}`]
  console.log(stamps.filter(Boolean).join('  '))
}

function printRoutines(routines: RoutineView[]): void {
  if (routines.length === 0) return console.log('(none)')
  for (const r of routines) {
    const mark = r.done ? '[x]' : r.scheduledToday ? '[ ]' : ' - '
    const streak = r.streak > 0 ? `streak ${r.streak}` : ''
    console.log([mark, r.id.padEnd(10), r.title.padEnd(28), r.schedule.padEnd(16), streak, r.note].filter(Boolean).join(' '))
  }
}

function printToday(d: { date: string; routines: RoutineView[]; pinned: TaskView[]; today: TaskView[]; inProgress: TaskView[] }): void {
  console.log(`Today, ${d.date}\n`)
  const section = (title: string, body: () => void, count: number) => {
    if (count === 0) return
    console.log(`${title}`)
    body()
    console.log()
  }
  section('Routines', () => printRoutines(d.routines), d.routines.length)
  section('Pinned', () => printTasks(d.pinned), d.pinned.length)
  section('Today', () => printTasks(d.today), d.today.length)
  section('In progress', () => printTasks(d.inProgress), d.inProgress.length)
  if (!d.routines.length && !d.pinned.length && !d.today.length && !d.inProgress.length) console.log('Nothing on. Enjoy.')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
