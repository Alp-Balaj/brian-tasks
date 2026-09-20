import { create } from 'zustand'
import { localStorageRepository, type Repository, type Snapshot } from './repository'
import { migrateV1, migrateV2 } from './migrate'
import { useTasks } from './tasks'
import { useSpaces, sortSpaces } from './spaces'
import { useRoutines, routineRecords } from './routines'
import { useTombstones } from './tombstones'

const repo: Repository = localStorageRepository

export const useHydration = create<{ hydrated: boolean }>(() => ({ hydrated: false }))

let started = false

/**
 * Load one snapshot into the data stores, then save the combined snapshot after
 * every change to any of them. Cheap enough at this scale; debounce if it ever
 * isn't. Safe to call more than once (StrictMode double-runs effects).
 */
export async function hydrate(): Promise<void> {
  if (started) return
  started = true

  let snapshot = await repo.load()
  if (!snapshot) {
    snapshot = migrateV2(migrateV1(await loadDevSeed()))
    await repo.save(snapshot)
  }
  applySnapshot(snapshot)

  const save = () => void repo.save(currentSnapshot())
  useTasks.subscribe(save)
  useSpaces.subscribe(save)
  useRoutines.subscribe(save)
  useTombstones.subscribe(save)

  useHydration.setState({ hydrated: true })
}

/** Push a whole snapshot into the stores (initial load, and after catching up with the server). */
export function applySnapshot(snapshot: Snapshot): void {
  useTasks.setState({ tasks: snapshot.tasks })
  useSpaces.setState({ spaces: sortSpaces(snapshot.spaces) })
  useRoutines.getState().replaceAll(snapshot.routines, snapshot.checkIns)
  useTombstones.setState({ tombstones: snapshot.tombstones })
}

export const currentSnapshot = (): Snapshot => ({
  tasks: useTasks.getState().tasks,
  spaces: useSpaces.getState().spaces,
  routines: routineRecords(useRoutines.getState().routines),
  checkIns: useRoutines.getState().checkIns,
  tombstones: useTombstones.getState().tombstones,
})

/**
 * First-run seed for `npm run dev` only: `dev/seed.json` (v1 shape), produced by
 * `scripts/import-obsidian.mjs`. The branch is dead code in production builds,
 * so the file never ships; a fresh Device starts empty and fills from the server.
 */
async function loadDevSeed(): Promise<unknown[]> {
  if (!import.meta.env.DEV) return []
  try {
    // A glob, not a plain import, so a checkout without the file still builds.
    const load = import.meta.glob<{ default: unknown }>('../../dev/seed.json')['../../dev/seed.json']
    const seed = load ? (await load()).default : []
    return Array.isArray(seed) ? seed : []
  } catch {
    return []
  }
}
