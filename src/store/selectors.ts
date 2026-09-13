import { useMemo } from 'react'
import type { Task } from '../domain/task'
import { ALL_SPACES, type SpaceSelection } from '../domain/space'
import { useTasks } from './tasks'
import { useSpaceSelection } from './ui'

const inSelection = (t: Task, selection: SpaceSelection) => selection === ALL_SPACES || t.spaceId === selection

/** Non-archived tasks in the selected space (`'all'` → every space). */
export const visibleTasks = (tasks: Task[], selection: SpaceSelection) =>
  tasks.filter((t) => !t.archived && inSelection(t, selection))

/** Archived tasks in the selected space — what the Archive page lists (Q27). */
export const archivedTasks = (tasks: Task[], selection: SpaceSelection) =>
  tasks.filter((t) => t.archived && inSelection(t, selection))

/** What Board, List and Calendar render. Home reads `useTasks` directly instead (Q3). */
export function useVisibleTasks(): Task[] {
  const tasks = useTasks((s) => s.tasks)
  const selected = useSpaceSelection((s) => s.selected)
  return useMemo(() => visibleTasks(tasks, selected), [tasks, selected])
}
