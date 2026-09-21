import type { ComponentType } from 'react'
import { ArchiveIcon, BoardIcon, CalendarIcon, HomeIcon, ListIcon, WeekIcon } from './icons'

/** The five pages in nav order (the mobile tab bar, the sidebar, keys 1–5), then Archive. */
export const PAGES: { to: string; label: string; Icon: ComponentType<{ size?: number }>; key: string }[] = [
  { to: '/home', label: 'Home', Icon: HomeIcon, key: '1' },
  { to: '/week', label: 'Week', Icon: WeekIcon, key: '2' },
  { to: '/board', label: 'Board', Icon: BoardIcon, key: '3' },
  { to: '/list', label: 'List', Icon: ListIcon, key: '4' },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon, key: '5' },
  { to: '/archive', label: 'Archive', Icon: ArchiveIcon, key: 'a' },
]
