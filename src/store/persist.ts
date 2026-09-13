import { create } from 'zustand'
import { localStorageRepository, type Repository, type Snapshot } from './repository'
import { migrateV1 } from './migrate'
import { useTasks } from './tasks'
import { useSpaces, sortSpaces } from './spaces'
import { useRoutines } from './routines'

const repo: Repository = localStorageRepository

export const useHydration = create<{ hydrated: boolean }>(() => ({ hydrated: false }))

let started = false

/**
 * Load one snapshot into the three data stores, then save the combined snapshot
 * after every change to any of them. Cheap enough at this scale; debounce if it
 * ever isn't. Safe to call more than once (StrictMode double-runs effects).
 */
export async function hydrate(): Promise<void> {
  if (started) return
  started = true

  let snapshot = await repo.load()
  if (!snapshot) {
    snapshot = migrateV1(await loadSeed())
    await repo.save(snapshot)
  }

  useTasks.setState({ tasks: snapshot.tasks })
  useSpaces.setState({ spaces: sortSpaces(snapshot.spaces) })
  useRoutines.setState({ routines: snapshot.routines })

  const save = () => void repo.save(currentSnapshot())
  useTasks.subscribe(save)
  useSpaces.subscribe(save)
  useRoutines.subscribe(save)

  useHydration.setState({ hydrated: true })
}

export const currentSnapshot = (): Snapshot => ({
  tasks: useTasks.getState().tasks,
  spaces: useSpaces.getState().spaces,
  routines: useRoutines.getState().routines,
})

/** First-run seed: `public/seed.json` (v1 shape), produced by `scripts/import-obsidian.mjs`. Optional. */
async function loadSeed(): Promise<unknown[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}seed.json`)
    if (!res.ok) return []
    const data: unknown = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
