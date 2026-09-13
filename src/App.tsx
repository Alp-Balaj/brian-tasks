import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTasks } from './store/tasks'
import { Shell } from './components/Shell'
import { BoardView } from './views/board/BoardView'
import { ListView } from './views/list/ListView'
import { CalendarView } from './views/calendar/CalendarView'

export default function App() {
  const hydrate = useTasks((s) => s.hydrate)
  const hydrated = useTasks((s) => s.hydrated)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return <div className="grid h-full place-items-center text-sm text-neutral-500">Loading…</div>
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/board" replace />} />
        <Route path="/board" element={<BoardView />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Route>
    </Routes>
  )
}
