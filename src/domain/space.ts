// Space model. A Space is the one container a Task lives in; Spaces partition Tasks.
// Same rule as task.ts: no UI / storage concerns here.
import type { ISODateTime } from './task.ts'

export interface Space {
  id: string
  name: string
  /** Hex colour, one of SPACE_COLOURS. Shown as a dot next to tasks in "All spaces" and on Home. */
  colour: string
  /** Manual ordering in the switcher (lower = higher up). */
  order: number
  /** Last change on any Device; decides which copy wins when Devices catch up. */
  updatedAt: ISODateTime
}

/** The built-in Space. Cannot be deleted; tasks of a deleted Space move here. */
export const DEFAULT_SPACE_ID = 'personal'

/** Switcher choice that shows every Task from every Space. Not a Space itself. */
export const ALL_SPACES = 'all' as const

/** A Space id, or ALL_SPACES. */
export type SpaceSelection = string | typeof ALL_SPACES

/** Picker palette by name. Kept deliberately small so colours stay tellable apart. */
export const SPACE_COLOUR_NAMES = {
  green: '#2f6f5e',
  blue: '#5b6fb8',
  orange: '#a8622a',
  purple: '#8a5a9c',
  red: '#b8434e',
  yellow: '#c39a2a',
  teal: '#2a8fa8',
  grey: '#6f7873',
} as const

export type SpaceColourName = keyof typeof SPACE_COLOUR_NAMES

/** The palette as hex values, in picker order. */
export const SPACE_COLOURS: readonly string[] = Object.values(SPACE_COLOUR_NAMES)

/** First palette colour no Space uses yet, so new Spaces stay tellable apart by default. */
export const nextFreeColour = (spaces: readonly Space[]): string =>
  SPACE_COLOURS.find((c) => !spaces.some((s) => s.colour === c)) ?? SPACE_COLOURS[0]

export type NewSpace = Pick<Space, 'name' | 'colour'>
export type SpacePatch = Partial<Omit<Space, 'id' | 'updatedAt'>>

export const defaultSpace = (): Space => ({
  id: DEFAULT_SPACE_ID,
  name: 'Personal',
  colour: SPACE_COLOURS[0],
  order: 0,
  updatedAt: new Date(0).toISOString(),
})
