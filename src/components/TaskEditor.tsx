import { useEffect, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { useTasks } from '../store/tasks'
import { useSpaces } from '../store/spaces'
import { useBlocks } from '../store/blocks'
import { Sheet } from './Sheet'
import { SpaceDot } from './TaskCard'
import { Button, ChipButton, Segmented, SectionLabel, field, type Tone } from './ui'
import { CloseIcon } from './icons'
import { formatDay, shiftISODate, toISODate } from '../lib/dates'
import { useToday } from '../lib/useToday'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ISODate,
  type Task,
  type TaskPriority,
} from '../domain/task'
import { describeSpan, isTimed, unplacedOn } from '../domain/block'

interface Props {
  taskId: string
  onClose: () => void
}

const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))
const PRIORITY_OPTIONS = TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))
const PRIORITY_TONES: Partial<Record<TaskPriority, Tone>> = { urgent: 'danger', high: 'warn' }

/** Full edit form for one task. Every change is saved immediately (no Save button). */
export function TaskEditor({ taskId, onClose }: Props) {
  const task = useTasks((s) => s.tasks.find((t) => t.id === taskId))
  const update = useTasks((s) => s.update)
  const archive = useTasks((s) => s.archive)
  const togglePin = useTasks((s) => s.togglePin)
  const spaces = useSpaces((s) => s.spaces)

  if (!task) return null
  const set = (patch: Parameters<typeof update>[1]) => update(task.id, patch)
  const done = task.status === 'done'

  return (
    <Sheet
      onClose={onClose}
      title="Task"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-faint">Created {task.createdAt.slice(0, 10)}</span>
          {/* Permanent delete lives only on the Archive page (Q28). */}
          <Button
            variant="ghost"
            onClick={() => {
              archive(task.id)
              onClose()
            }}
          >
            Archive
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <AutoTextarea
          value={task.title}
          onChange={(e) => set({ title: e.target.value })}
          rows={1}
          placeholder="Title"
          aria-label="Title"
          className={`w-full resize-none bg-transparent text-xl font-semibold leading-snug outline-none placeholder:text-fg-faint ${
            done ? 'text-fg-faint line-through' : ''
          }`}
        />

        <Field label="Status">
          <Segmented value={task.status} options={STATUS_OPTIONS} onChange={(status) => set({ status })} label="Status" />
        </Field>

        <Field label="Priority">
          <Segmented
            value={task.priority}
            options={PRIORITY_OPTIONS}
            onChange={(priority) => set({ priority })}
            label="Priority"
            tones={PRIORITY_TONES}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <DateField label="Due" value={task.due} onChange={(due) => set({ due })} />
          <DateField label="Scheduled" value={task.scheduled} onChange={(scheduled) => set({ scheduled })} />
        </div>

        <PlacedLine task={task} />

        <Field label="Space">
          <div role="radiogroup" aria-label="Space" className="flex flex-wrap gap-1.5">
            {spaces.map((s) => (
              <ChipButton
                key={s.id}
                role="radio"
                aria-checked={s.id === task.spaceId}
                active={s.id === task.spaceId}
                onClick={() => set({ spaceId: s.id })}
                className="inline-flex items-center gap-2"
              >
                <SpaceDot colour={s.colour} />
                {s.name}
              </ChipButton>
            ))}
          </div>
        </Field>

        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3">
          <span className="text-sm">Pinned to Home</span>
          <Switch checked={task.pinned} disabled={done} onChange={() => togglePin(task.id)} label="Pinned to Home" />
        </label>

        <Field label="Tags">
          <TagsField value={task.tags} onChange={(tags) => set({ tags })} />
        </Field>

        <Field label="Description">
          <AutoTextarea
            value={task.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            placeholder="Notes, links, next steps…"
            className={`${field} resize-none py-2.5 leading-relaxed`}
          />
        </Field>
      </div>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

/**
 * Where the task is placed on the Week page, read-only (§5.7): one line per placement
 * with its hour and block. Placing is done from the Week page and the block sheet;
 * Scheduling here creates nothing on the grid (TB-15), and re-Scheduling never removes
 * a placement — the task is then "Scheduled Mon, not placed" (TB-17), said here.
 */
function PlacedLine({ task }: { task: Task }) {
  const placements = useBlocks((s) => s.placements)
  const blocks = useBlocks((s) => s.blocks)
  const today = useToday()

  const mine = placements
    .filter((p) => p.taskId === task.id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? Infinity) - (b.start ?? Infinity))
  const unplaced = task.scheduled !== undefined && unplacedOn([task], placements, task.scheduled).length > 0
  if (mine.length === 0 && !unplaced) return null

  return (
    <Field label="Placed">
      {mine.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {mine.map((p) => {
            const block = p.blockId ? blocks.find((b) => b.id === p.blockId) : undefined
            return (
              <li key={p.id} className={`tabular-nums ${p.date < today ? 'text-fg-muted' : ''}`}>
                {formatDay(p.date, today)}
                {isTimed(p) && ` ${describeSpan(p.start, p.end)}`}
                {block && <span className="text-fg-muted"> · in {block.name}</span>}
              </li>
            )
          })}
        </ul>
      )}
      {unplaced && task.scheduled && (
        <span className="text-sm text-warn">Scheduled {formatDay(task.scheduled, today)}, not placed</span>
      )}
    </Field>
  )
}

/** Native date input plus Today / Tomorrow / Clear shortcuts, so the common cases are one tap. */
function DateField({ label, value, onChange }: { label: string; value?: ISODate; onChange: (v?: ISODate) => void }) {
  const today = toISODate(new Date())
  const tomorrow = shiftISODate(today, 1)
  return (
    <Field label={value ? `${label} · ${formatDay(value, today)}` : label}>
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={field} />
      <div className="flex flex-wrap gap-1.5">
        <ChipButton active={value === today} onClick={() => onChange(today)} className="min-h-8 px-2.5 text-xs">
          Today
        </ChipButton>
        <ChipButton active={value === tomorrow} onClick={() => onChange(tomorrow)} className="min-h-8 px-2.5 text-xs">
          Tomorrow
        </ChipButton>
        {value && (
          <ChipButton onClick={() => onChange(undefined)} className="min-h-8 px-2.5 text-xs">
            Clear
          </ChipButton>
        )}
      </div>
    </Field>
  )
}

/** On/off toggle with a 28px track inside a 44px row. Shared with BlockSheet ("Carry to next week"). */
export function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

/** Tags as removable chips; Enter or comma adds what was typed. */
function TagsField({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const tag = draft.trim().replace(/,+$/, '').trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={`${field} flex min-h-11 flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-md bg-surface-2 py-0.5 pr-0.5 pl-2 text-sm">
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            aria-label={`Remove tag ${t}`}
            className="grid h-6 w-6 place-items-center rounded text-fg-faint hover:text-fg"
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? 'Add a tag' : ''}
        aria-label="Add a tag"
        className="min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-fg-faint md:text-sm"
      />
    </div>
  )
}

/** Textarea that grows with its content instead of scrolling inside the sheet. */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return <textarea ref={ref} {...props} />
}
