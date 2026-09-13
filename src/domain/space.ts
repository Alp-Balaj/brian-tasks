// Space model. A Space is the one container a Task lives in; Spaces partition Tasks.
// Same rule as task.ts: no UI / storage concerns here.

export interface Space {
  id: string
  name: string
  /** Hex colour, one of SPACE_COLOURS. Shown as a dot next to tasks in "All spaces" and on Home. */
  colour: string
  /** Manual ordering in the switcher (lower = higher up). */
  order: number
}

/** The built-in Space. Cannot be deleted; tasks of a deleted Space move here. */
export const DEFAULT_SPACE_ID = 'personal'

/** Switcher choice that shows every Task from every Space. Not a Space itself. */
export const ALL_SPACES = 'all' as const

/** A Space id, or ALL_SPACES. */
export type SpaceSelection = string | typeof ALL_SPACES

/** Picker palette. Kept deliberately small so colours stay tellable apart. */
export const SPACE_COLOURS: readonly string[] = [
  '#2f6f5e', // green
  '#5b6fb8', // blue
  '#a8622a', // orange
  '#8a5a9c', // purple
  '#b8434e', // red
  '#c39a2a', // yellow
  '#2a8fa8', // teal
  '#6f7873', // grey
]

export type NewSpace = Pick<Space, 'name' | 'colour'>
export type SpacePatch = Partial<Omit<Space, 'id'>>

export const defaultSpace = (): Space => ({
  id: DEFAULT_SPACE_ID,
  name: 'Personal',
  colour: SPACE_COLOURS[0],
  order: 0,
})
