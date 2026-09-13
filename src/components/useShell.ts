import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from './Shell'

export const useShell = () => useOutletContext<ShellContext>()
