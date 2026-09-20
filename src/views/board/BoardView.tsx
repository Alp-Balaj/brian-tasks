import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { STATUS_LABEL, TASK_STATUSES, isTaskStatus, type Task, type TaskStatus } from '../../domain/task'
import { byColumn, useTasks } from '../../store/tasks'
import { useVisibleTasks } from '../../store/selectors'
import { TaskCard } from '../../components/TaskCard'
import { QuickAdd } from '../../components/QuickAdd'
import { StatusMenu } from '../../components/StatusMenu'
import { useShell } from '../../components/useShell'
import { PlusIcon } from '../../components/icons'

/**
 * Kanban: one column per status. Drag between/within columns; every card also has a
 * status button (tap alternative, essential on a phone).
 * Phone: one full-width column at a time, snapping, with a status bar on top to jump
 * between columns. Desktop: all columns side by side.
 */
export function BoardView() {
  const tasks = useVisibleTasks()
  const move = useTasks((s) => s.move)
  const { openTask } = useShell()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addTo, setAddTo] = useState<TaskStatus | null>(null)
  const [statusFor, setStatusFor] = useState<string | null>(null)
  const [visible, setVisible] = useState<TaskStatus>('todo')
  const scroller = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    // Activation distance/delay lets a plain tap still open the task instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  // Which column is in view on the phone (each column is one scroll-snap page wide).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => {
      // The column whose left edge is nearest the scroll position is the one on screen.
      const columns = Array.from(el.children) as HTMLElement[]
      let page = 0
      let nearest = Infinity
      columns.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - el.scrollLeft)
        if (d < nearest) {
          nearest = d
          page = i
        }
      })
      const status = TASK_STATUSES[page] ?? 'todo'
      setVisible((v) => (v === status ? v : status))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const jumpTo = (status: TaskStatus) => {
    const column = scroller.current?.children[TASK_STATUSES.indexOf(status)]
    column?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)

    // Dropped on a column body (empty space) → append to that column.
    if (isTaskStatus(overId)) {
      move(id, overId, Number.MAX_SAFE_INTEGER)
      return
    }
    // Dropped on another card → take its slot.
    const target = tasks.find((t) => t.id === overId)
    if (!target) return
    const column = byColumn(tasks, target.status)
    const index = column.findIndex((t) => t.id === overId)
    move(id, target.status, index)
  }

  const active = activeId ? tasks.find((t) => t.id === activeId) : undefined

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col">
        {/* Phone: status bar to jump between columns. */}
        <div role="tablist" aria-label="Column" className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-1 md:hidden">
          {TASK_STATUSES.map((status) => {
            const current = status === visible
            return (
              <button
                key={status}
                role="tab"
                aria-selected={current}
                onClick={() => jumpTo(status)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${
                  current ? 'bg-fg text-bg' : 'bg-surface-2 text-fg-muted'
                }`}
              >
                {STATUS_LABEL[status]}
                <span className={`text-xs tabular-nums ${current ? 'opacity-70' : 'text-fg-faint'}`}>
                  {byColumn(tasks, status).length}
                </span>
              </button>
            )
          })}
        </div>

        <div
          ref={scroller}
          className="relative flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pt-2 pb-3 md:snap-none md:pt-3"
        >
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={byColumn(tasks, status)}
              onOpen={openTask}
              onStatus={setStatusFor}
              onAdd={() => setAddTo(status)}
            />
          ))}
        </div>
      </div>
      <DragOverlay>{active ? <TaskCard task={active} /> : null}</DragOverlay>
      {addTo && <QuickAdd defaults={{ status: addTo }} onClose={() => setAddTo(null)} />}
      {statusFor && <StatusMenu taskId={statusFor} onClose={() => setStatusFor(null)} />}
    </DndContext>
  )
}

function Column({
  status,
  tasks,
  onOpen,
  onStatus,
  onAdd,
}: {
  status: TaskStatus
  tasks: Task[]
  onOpen: (id: string) => void
  onStatus: (id: string) => void
  onAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      className={`flex w-full shrink-0 snap-start flex-col rounded-2xl bg-surface-2 md:w-72 ${
        isOver ? 'ring-2 ring-accent' : ''
      }`}
    >
      {/* The phone shows the column name in the status bar above; its add button sits under the cards. */}
      <header className="hidden items-center justify-between py-1 pr-1 pl-3 text-sm font-medium md:flex">
        <span>
          {STATUS_LABEL[status]} <span className="text-fg-faint">{tasks.length}</span>
        </span>
        <button
          onClick={onAdd}
          aria-label={`Add task to ${STATUS_LABEL[status]}`}
          className="grid h-10 w-10 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <PlusIcon size={18} />
        </button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-2 md:pt-0">
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onOpen={() => onOpen(t.id)} onStatus={() => onStatus(t.id)} />
          ))}
          <button
            onClick={onAdd}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg md:hidden"
          >
            <PlusIcon size={16} />
            Add to {STATUS_LABEL[status].toLowerCase()}
          </button>
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ task, onOpen, onStatus }: { task: Task; onOpen: () => void; onStatus: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="touch-manipulation"
    >
      <TaskCard task={task} onClick={onOpen} onStatus={onStatus} />
    </div>
  )
}
