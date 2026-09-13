import { useState } from 'react'
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
import { TaskCard } from '../../components/TaskCard'
import { QuickAdd } from '../../components/QuickAdd'
import { useShell } from '../../components/useShell'

/**
 * Kanban: one column per status. Drag between/within columns.
 * Horizontal scroll on mobile (columns snap), all columns visible on desktop.
 */
export function BoardView() {
  const tasks = useTasks((s) => s.tasks)
  const move = useTasks((s) => s.move)
  const { openTask } = useShell()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addTo, setAddTo] = useState<TaskStatus | null>(null)

  const sensors = useSensors(
    // Activation distance/delay lets a plain tap still open the task instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

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
      <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto p-3 md:snap-none">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={byColumn(tasks, status)}
            onOpen={openTask}
            onAdd={() => setAddTo(status)}
          />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} /> : null}</DragOverlay>
      {addTo && <QuickAdd defaults={{ status: addTo }} onClose={() => setAddTo(null)} />}
    </DndContext>
  )
}

function Column({
  status,
  tasks,
  onOpen,
  onAdd,
}: {
  status: TaskStatus
  tasks: Task[]
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      className={`flex w-[85vw] shrink-0 snap-center flex-col rounded-lg bg-neutral-100 md:w-72 ${
        isOver ? 'ring-2 ring-neutral-400' : ''
      }`}
    >
      <header className="flex items-center justify-between px-3 py-2 text-sm font-medium">
        <span>
          {STATUS_LABEL[status]} <span className="text-neutral-400">{tasks.length}</span>
        </span>
        <button onClick={onAdd} className="rounded px-1.5 text-neutral-500 hover:bg-neutral-200">
          +
        </button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onOpen={() => onOpen(t.id)} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="touch-manipulation"
    >
      <TaskCard task={task} onClick={onOpen} />
    </div>
  )
}
