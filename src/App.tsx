import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { hydrate, useHydration } from './store/persist'
import { startSync } from './sync/engine'
import { useSync } from './sync/status'
import { LoginScreen } from './components/LoginScreen'
import { Shell } from './components/Shell'
import { HomeView } from './views/home/HomeView'
import { BoardView } from './views/board/BoardView'
import { ListView } from './views/list/ListView'
import { CalendarView } from './views/calendar/CalendarView'
import { ArchiveView } from './views/archive/ArchiveView'

export default function App() {
  const hydrated = useHydration((s) => s.hydrated)
  const signedOut = useSync((s) => s.status === 'signed-out')

  useEffect(() => {
    void hydrate().then(startSync)
  }, [])

  if (!hydrated) {
    return <div className="grid h-full place-items-center text-sm text-neutral-500">Loading…</div>
  }
  if (signedOut) return <LoginScreen />

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomeView />} />
        <Route path="/board" element={<BoardView />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/archive" element={<ArchiveView />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  )
}
