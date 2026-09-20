// One-off importer: Obsidian TaskNotes (markdown + YAML frontmatter) -> dev/seed.json
// Usage: node scripts/import-obsidian.mjs "/path/to/vault/1 - Managing Brian/Tasks"
// The dev build loads it only when local storage is empty (first run); production never does.
// This is a data import, not a model: the app's own task model lives in src/domain/task.ts.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/import-obsidian.mjs <tasks-folder>')
  process.exit(1)
}

const STATUS = { open: 'todo', priority: 'todo', 'in-progress': 'in-progress', hold: 'hold', done: 'done' }
const PRIORITY = { low: 'low', normal: 'normal', high: 'high' }

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return { fm: {}, body: text }
  const fm = {}
  let currentList = null
  for (const line of m[1].split(/\r?\n/)) {
    const list = line.match(/^\s+-\s+(.*)$/)
    if (list && currentList) {
      fm[currentList].push(list[1].trim())
      continue
    }
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, value] = kv
    if (value === '') {
      fm[key] = []
      currentList = key
    } else {
      fm[key] = value.replace(/^["']|["']$/g, '')
      currentList = null
    }
  }
  return { fm, body: text.slice(m[0].length).trim() }
}

const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined)
const dateTime = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined)

const tasks = []
let order = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const { fm, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'))
  const created = dateTime(fm.dateCreated) ?? new Date().toISOString()
  const status = STATUS[fm.status] ?? 'todo'
  // Obsidian's "priority" status is really a flag; surface it as high priority in this app.
  const priority = fm.status === 'priority' ? 'high' : (PRIORITY[fm.priority] ?? 'normal')
  const tags = (Array.isArray(fm.tags) ? fm.tags : [])
    .filter((t) => typeof t === 'string' && !t.startsWith('uid:'))
    .filter((t) => t !== 'task')
  tasks.push({
    id: `ob-${order.toString(36).padStart(4, '0')}`,
    title: basename(file, '.md'),
    description: body,
    status,
    priority,
    tags,
    due: date(fm.due),
    scheduled: date(fm.scheduled),
    order: order++,
    createdAt: created,
    updatedAt: dateTime(fm.dateModified) ?? created,
    completedAt: status === 'done' ? (dateTime(fm.completedDate) ?? created) : undefined,
  })
}

mkdirSync('public', { recursive: true })
writeFileSync('dev/seed.json', JSON.stringify(tasks, null, 2))
console.log(`wrote ${tasks.length} tasks to dev/seed.json`)
