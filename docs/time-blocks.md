# Time blocks — agreement and implementation plan

Two parts. **Part 1** is the feature agreement (what is being built), settled with the
user on 2026-09-20 across ~40 design questions; treat it as the spec, and the numbered
items as the ids to cite in code comments (`(TB-12)`). **Part 2** is the technical plan:
data model, sync, files, phases, and a session ownership table so several Claude Code
sessions can work at once, in the same style as `PLAN.md`.

A new session should read `CONTEXT.md`, `docs/adr/0001`, this file, and then only the
phase it owns.

---

# Part 1 — Feature agreement

**Purpose.** See the open time in the week and put things in it. Not a calendar of
appointments, not a time tracker, not a second task list.

## The week

- **TB-1** Real, dated weeks (Mon–Sun), navigable any distance forward or back. Past weeks
  stay as a record; nothing on them is special.
- **TB-2** Open time = any hour with no block. Sleep is drawn like anything else. Gaps
  are the display; nothing is computed or totalled.

## Blocks

- **TB-3** A **block** is a coloured span on one day: free-text **name**, **colour** from a
  fixed palette, start, end. No shared "kind" entity; the legend is derived from distinct
  names, and the name field autocompletes from existing names (prefilling that name's
  colour).
- **TB-4** **Carry to next week** is a plain on/off per block. On = **standing** (Job,
  Gym, Sleep); off = one-off. Weekly is the only rhythm; anything else is fixed by hand.
  Default for a new block: **off**.
- **TB-5** Editing a standing block applies to **this week and all future weeks; past
  weeks keep what they had**. Same for turning carry-over off. No "this/future/all"
  dialog — a one-week deviation is a one-off block.
- **TB-6** Blocks may overlap each other; overlapping regions are drawn hatched in a
  distinct colour.
- **TB-7** A block lives inside one day (00:00–24:00). Sleep 22–06 is two blocks.

## What is inside a block

- **TB-8** A block holds linked **Routines** and linked **Tasks**. A linked Task has no
  hour by default: "sometime during this block".
- **TB-9** On a standing block, **Routine links carry** to future weeks; **Task links do
  not** — the slot recurs, its contents are decided each week.
- **TB-10** Tapping a block opens its **sheet**: name, colour, day, time, carry-over
  toggle, linked Routines (check-in inline, today only), linked Tasks (done inline),
  **+ task**, **+ routine**. The task picker shows **that day's unplaced Scheduled tasks
  first**, then a search over all open tasks.
- **TB-11** A linked task in the sheet has an optional **"at…"** time; setting it draws
  the task on the grid at that hour (*Path A*).

## Placements (tasks on a day)

- **TB-12** A **placement** is a Task on a day, with an optional hour and an optional
  block. With an hour it is drawn on the grid **on top of** blocks (hatched where it
  overlaps) or in open time. Placements may overlap each other too.
- **TB-13** Created via *Path A* (from a block's sheet) or *Path B* (desktop: drag on the
  grid → "New block or place a task?" → pick task; phone: a form with day/start/end/task).
- **TB-14** The same Task can be placed any number of times in a week.
- **TB-15** Placing a Task sets its **Scheduled** date to the earliest of its placement
  days. The reverse is not true: Scheduling from the Task editor creates nothing on the
  grid.
- **TB-16** When a Task is done or archived, its placements **stay**, drawn as done — an
  honest record in the past, a visibly stale mark in the future, one tap to remove.
- **TB-17** Changing Scheduled from the editor **never deletes** a placement; the task
  simply becomes "Scheduled Mon, not placed" and its old placement shows a mismatch hint.

## Scheduled-but-unplaced

- **TB-18** A Task is **placed on day D** if it has any placement on D. On the week page,
  each day row ends with a **tray** at its far right listing Tasks Scheduled that day but
  not placed; tap one to put it in a block. No tray on Home, no mark on the task itself.

## Where it lives

- **TB-19** **Week page** (own nav item): the full 7×24 grid, the trays, all editing.
- **TB-20** **Home**: a **today strip** at the very top (blocks, placements, now-marker;
  tap to open a sheet), then **Today → Overdue → Routines → Pinned → In progress**.
  Today rows for placed tasks show their hour; Routine rows linked to a block show the
  block's hour. `CONTEXT.md`'s Home definition changes to this order.
- **TB-21** On the grid, untimed linked tasks are written inside the block when there is
  room, a count badge otherwise; Home's strip always uses the badge.

## Editing

- **TB-22** **Desktop**: drag on empty time to create a block, drag edges to resize, drag
  to move. **Phone**: forms only (create/edit from the sheet).

## Deliberately out

- **TB-23** No "this week only" edits of standing blocks; no rhythms beyond weekly; no
  computed open-time totals; no write-back to Tasks beyond Scheduled; no MCP/CLI tools
  for Placements (`today` reports them). Block tools (`list_blocks`, `create_block`,
  `update_block`, `delete_block`) were added after v1, on the same TB-5 rules as the sheet.

---

# Part 2 — Technical plan

## 0. Decisions (the "why", short)

| # | Decision | Why |
|---|---|---|
| D1 | Standing blocks are **versioned rules** (`from`/`until` week keys), not copies materialised per week. | TB-5 falls out of one operation (split at week W); nothing is written when a new week is opened; a standing block is one row instead of one row per week forever. ADR 0003. |
| D2 | One-off block = a rule whose `until` is the following week. "Carry to next week" in the UI is `until === undefined`. | One record shape, one query (`appliesTo(block, week)`), no boolean that can disagree with the range. |
| D3 | Task-in-block, task-at-hour and both are the **same record**: `Placement { taskId, date, blockId?, start?, end? }`. | TB-8/11/12/13 are one thing seen from three sides. Per-date, so TB-9 (task links do not carry) needs no logic. |
| D4 | Routine links live **on the block** (`routineIds`). | TB-9: they carry with the block, and are versioned with it. |
| D5 | Times are **minutes from midnight**, integers, multiples of 15, `0 ≤ start < end ≤ 1440`. | Integers compare and snap trivially; ISO time strings would need parsing everywhere. 15 min is the finest the drawn grid can show. |
| D6 | A week is keyed by the **ISODate of its Monday** (`WeekKey`). | Same lexicographic-comparison trick as `ISODate`; `weekOf(date)` is the only conversion. |
| D7 | Two new sync kinds, `block` and `placement`, on-device snapshot **v4**. | Follows the existing per-entity LWW model unchanged (ADR 0001). |
| D8 | On a split (TB-5), the **past** version keeps the id; the **future** version gets a new id and placements from week W onward are re-pointed. | Future placements are few (this week, maybe next); past ones can be many. |
| D9 | `Task.scheduled` is written by the placement store, derived as `min(placement.date)` over the task's placements; never cleared by the store. | TB-15/17. A placement's `date` is the source; `scheduled` is a projection of it that the rest of the app already understands. |
| D10 | Desktop drag is raw pointer events on the row, not `@dnd-kit`. | dnd-kit models sortable lists / drop targets; a 1-D time ruler with snap, resize and create-by-drag is 150 lines of pointer math. |
| D11 | Blocks store a palette **hex**; 12 colours, chosen to read on both themes as filled bars with text. | Same as Spaces; free hex is out (TB-3). |

## 1. Domain — `src/domain/block.ts` (new)

Pure types and functions; no UI/store imports; `.ts` extensions on relative imports
(the server imports this file).

```ts
import type { ISODate, ISODateTime } from './task.ts'
import type { Weekday } from './routine.ts'

/** ISODate of a Monday. Sorts like ISODate. */
export type WeekKey = ISODate
/** Minutes from midnight, 0..1440, multiple of STEP. */
export type Minutes = number
export const STEP = 15
export const DAY = 1440

export interface Block {
  id: string
  name: string
  /** One of BLOCK_COLOURS. */
  colour: string
  weekday: Weekday
  start: Minutes
  end: Minutes            // start < end <= DAY
  /** First week this version applies to. */
  from: WeekKey
  /** First week it no longer applies to (exclusive). undefined = carries to every next week. */
  until?: WeekKey
  /** Routines done in this block. Carry with the block (TB-9). */
  routineIds: string[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/**
 * A Task on a day. `blockId` = "sometime during this block"; `start`/`end` = drawn at
 * this hour. At least one of the two is set — a placement with neither is deleted.
 */
export interface Placement {
  id: string
  taskId: string
  date: ISODate
  blockId?: string
  start?: Minutes
  end?: Minutes
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type NewBlock = Pick<Block, 'name' | 'colour' | 'weekday' | 'start' | 'end'> &
  Partial<Pick<Block, 'routineIds'>> & { week: WeekKey; carry?: boolean }
export type BlockPatch = Partial<Pick<Block, 'name' | 'colour' | 'weekday' | 'start' | 'end' | 'routineIds'>>
export type NewPlacement = Pick<Placement, 'taskId' | 'date'> & Partial<Pick<Placement, 'blockId' | 'start' | 'end'>>
export type PlacementPatch = Partial<Pick<Placement, 'date' | 'blockId' | 'start' | 'end'>>
```

Palette (D11), stored as hex, exported as `BLOCK_COLOUR_NAMES` / `BLOCK_COLOURS` like
`space.ts`:

```
slate  #64748b   red    #dc4c4c   orange #e0823a   amber  #d9a428
lime   #7fa83a   green  #2f9e6a   teal   #2aa1a8   sky    #3b8fd6
blue   #4f6fd8   violet #7d5fd3   pink   #d65a9e   brown  #9a6b4f
```

Blocks are drawn as the colour at 90% opacity with white text; the plan does not
promise these exact values — P1 may tune them, but keeps 12 named entries and the
`nextFreeBlockColour(blocks)` rule (first colour no *name* uses yet).

Pure functions (each gets a test in `block.test.ts`):

```ts
weekOf(date: ISODate): WeekKey                       // Monday of that date's week
weekDays(week: WeekKey): ISODate[]                   // the 7 dates, Mon first
weekdayOf(date: ISODate): Weekday
appliesTo(block, week): boolean                      // from <= week && (until === undefined || week < until)
blocksInWeek(blocks, week): Block[]
blocksOn(blocks, date): Block[]                      // appliesTo(weekOf(date)) && weekday matches; sorted by start
carries(block): boolean                              // until === undefined
nextWeek(week): WeekKey                              // +7 days
splitAt(block, week, now): { past: Block; future: Block }   // D8; past.until = week, future.from = week, future.id fresh
overlaps(a: {start,end}, b): boolean
overlapRegions(items: {start,end}[]): {start,end}[]  // union of pairwise intersections, for the hatch layer
currentBlock(blocks, date, nowMinutes): Block | undefined   // first by start with start <= now < end
placementsOn(placements, date): Placement[]
placementsIn(placements, block, date): Placement[]   // blockId === block.id && date
placedDays(placements, taskId): ISODate[]            // sorted unique
scheduledFromPlacements(task, placements): ISODate | undefined   // min date, or undefined when none
unplacedOn(tasks, placements, date): Task[]          // scheduled === date, live, no placement on date; byPriority
isStalePlacement(p, task, placements): boolean       // TB-17 hint: task.scheduled set, ≠ p.date, and no placement on task.scheduled
describeMinutes(m): string                           // "06:00", "17:30"
describeSpan(start, end): string                     // "06:00–07:45"
snap(m): Minutes                                     // to STEP, clamped to [0, DAY]
```

`blockNames(blocks): { name: string; colour: string }[]` — distinct names with the
colour of the most recently updated block of that name; feeds the legend and the
autocomplete (TB-3).

## 2. Store — `src/store/blocks.ts` (new)

One zustand store holding both record kinds; mirrors `store/routines.ts`.

```ts
interface BlockState {
  blocks: Block[]
  placements: Placement[]

  addBlock(input: NewBlock): Block
  /**
   * TB-5. If block.from === week: patch in place. Otherwise splitAt(block, week), keep the
   * past version, apply patch to the future version, re-point placements with
   * date >= week from the old id to the new id (D8).
   */
  updateBlockFrom(id: string, week: WeekKey, patch: BlockPatch): void
  /** carry=false: until = nextWeek(week) (this week is the last). carry=true: until = undefined. Splits like updateBlockFrom when from < week. */
  setCarry(id: string, week: WeekKey, carry: boolean): void
  /** Deletes this one version only. Placements in it: untimed ones are removed, timed ones lose blockId. */
  removeBlock(id: string): void

  addPlacement(input: NewPlacement): Placement          // then syncScheduled(taskId)
  updatePlacement(id: string, patch: PlacementPatch): void   // a patch that leaves neither blockId nor time removes it
  removePlacement(id: string): void                     // then syncScheduled(taskId)

  replaceAll(blocks: Block[], placements: Placement[]): void
}
```

`syncScheduled(taskId)` (D9): `next = scheduledFromPlacements(task, placements)`; if
`next !== undefined && next !== task.scheduled`, `useTasks.getState().update(taskId, { scheduled: next })`.
Never clears `scheduled`.

Deletions bury tombstones (`'block'`, `'placement'`) exactly like `useRoutines.remove`.

`removeBlock` deliberately removes **one version**. The block sheet's "Delete" in week W
on a standing block from an earlier week is therefore `setCarry(id, W, false)` semantics
if the user wants it gone from W on, or a true delete of the whole lineage if they
confirm — v1 offers **"Remove from this week on"** (= `until = W`, split first if
needed, and remove its placements with `date >= W`) and **"Delete"** only when
`from === W` (one-off or just created). Keep the past honest (TB-1).

## 3. Persistence and sync

- `src/store/tombstones.ts`: `RowKind` adds `'block' | 'placement'`.
- `src/store/repository.ts`: `Snapshot` adds `blocks: Block[]`, `placements: Placement[]`;
  key `brian-tasks:v4`; `isSnapshot` checks the two arrays; `load()` upgrades v3 via
  `migrateV3` (adds empty arrays), then v2/v1 chains as today.
- `src/store/migrate.ts`: `SnapshotV3` type (the current `Snapshot` minus the two arrays),
  `migrateV3(v3): Snapshot`.
- `src/store/persist.ts`: subscribe `useBlocks`; `applySnapshot` / `currentSnapshot`
  include the two arrays.
- `src/sync/merge.ts`: `toRows` emits `block` and `placement` rows; `fromRows` collects
  them and repairs: placement whose task is gone → dropped; placement whose `blockId`
  is gone → `blockId` cleared, and dropped if it then has no time; block `routineIds`
  filtered to existing routines. Add cases to `merge.test.ts`.
- `src/sync/engine.ts`: subscribe `useBlocks` for the debounce trigger.
- `server/index.ts`: `KINDS` adds `'block'`, `'placement'`.
- `server/records.ts`: `blocks()`, `placements()`.
- `docs/adr/0003-standing-blocks-as-versioned-rules.md`: D1/D2/D8 in the ADR format
  of 0001 (status, considered options: materialised copies, RRULE, versioned rules;
  consequences: split re-points placements; a lineage has no id of its own, so "delete
  everywhere" is not offered in v1).

## 4. Vocabulary — `CONTEXT.md`

Add a **Time** section between Routines and Home:

- **Block** — a named, coloured span of one day on the Week page (Job 09–17). Not a
  Task, not an appointment. *Avoid:* event, slot, session.
- **Standing** — a Block that carries to every following week until told otherwise.
  *Avoid:* recurring, template, repeating.
- **Open time** — any part of a day with no Block. Never computed, only seen.
- **Placement** — a Task put on a specific day, inside a Block and/or at an hour. A Task
  can have several. *Avoid:* event, time slot, booking.
- **Placed / Unplaced** — a Task is placed on a day when it has a Placement there;
  unplaced = Scheduled for a day with no Placement on it.
- **Week** — the page: seven day rows, 00–24, Blocks and Placements drawn to scale,
  plus each day's unplaced tray. *Avoid:* schedule, timetable, planner.

Update **Scheduled**: "…Placing a Task on a day sets this to that day (the earliest, if
placed on several)." Update **Home**: strip first, then Today → Overdue → Routines →
Pinned → In progress.

## 5. UI

### 5.1 Routes and shell

- `src/App.tsx`: `<Route path="/week" element={<WeekView />} />`. Week in view is the
  search param `?w=<WeekKey>`, default `weekOf(today)`; `/week` with no param = this
  week, so the nav link is always "this week".
- `src/components/Shell.tsx`: `NAV` gains `{ to: '/week', label: 'Week', Icon: WeekIcon }`
  after Home (5 mobile tabs is the platform maximum; fine). `ShellContext` gains
  `openBlock: (id: string, date: ISODate) => void` and `placeTask: (task: Task, date: ISODate) => void`
  (opens the placement form). `BlockSheet` and `PlacementSheet` are mounted in Shell
  next to `TaskEditor`, so Home and Week share them.
- `src/components/icons.tsx`: `WeekIcon` (three horizontal bars of different widths in a
  frame, 24-px grid like the others).

### 5.2 Week page — `src/views/week/`

```
WeekView.tsx        header (‹ week › + "This week"), legend, 7 × DayRow, phone "+ block" per day
DayRow.tsx          label | ruler (relative div, hour ticks) | tray
TimeRuler.tsx       the shared hour axis (00 06 12 18 24), rendered once above the rows
BlockBar.tsx        one block: absolutely positioned, name inside when width ≥ 56px, count badge for untimed placements
PlacementBar.tsx    one timed placement: bottom 45% of the row, 1.5px outline in the task's Space colour, title when it fits, done = dimmed + strike
HatchLayer.tsx      overlap regions (block∩block, placement∩block) as `repeating-linear-gradient(135deg, …)` in `--fg` at 18% opacity
Tray.tsx            unplaced tasks for the day as chips (title, Space dot); tap → BlockSheet picker or PlacementSheet
useRulerDrag.ts     P4: pointer math for create / move / resize (desktop only, `(pointer: fine)`)
```

Layout: `grid-cols-[3rem_1fr_minmax(0,9rem)]` on desktop, `grid-cols-[3rem_1fr]` on
phone with the tray wrapping under the ruler as a chip row. Row height 44px desktop /
40px phone. Positions: `left: start/DAY*100%`, `width: (end-start)/DAY*100%`. Bars are
`<button>`s with `title` = `${name} · ${describeSpan}` so hover on desktop shows what a
narrow bar cannot.

Today's row: label in accent, a 1px vertical now-line at `nowMinutes/DAY*100%`
(from a `useNow()` hook ticking each minute, alongside `useToday`).

Legend: `blockNames(blocksInWeek)` as dots + names above the grid, wrapping.

Phone create: each row label is a button → `BlockSheet` in "new" mode with that
weekday preset. Desktop create: P4 drag; until P4 lands, same label button.

### 5.3 Block sheet — `src/components/BlockSheet.tsx`

Props `{ blockId: string | null, date: ISODate, preset?: Partial<NewBlock>, onClose }`.
`date` is the day it was opened from; `week = weekOf(date)`. Existing blocks save every
change immediately via `updateBlockFrom(id, week, patch)` (TB-5 is automatic); a new one
is a draft with "Add", like `RoutineEditor`.

Fields, top to bottom:

1. Name — `<input list="block-names">` + `<datalist>` from `blockNames(blocks)`; picking
   a known name sets the colour too (TB-3).
2. Colour — 12 swatches (radiogroup), like the Space picker.
3. Day — 7 chips (Mon…Sun). A new block's chips are multi-select: "Add" creates one
   block per chosen day (a Block is one day, TB-7), all with the same fields; an
   existing block has one day and the chips move it. Time — two `<select>`s at 15-min
   steps (`00:00`…`24:00`), end options filtered to `> start`.
4. **Carry to next week** — `Switch`, `carries(block)`, `setCarry(id, week, on)`.
   Helper text when on and `from < week`: "Standing since {from}".
5. **Routines** — rows with `CircleCheck` bound to today's check-in only (disabled with
   "check in on the day" otherwise), remove ×; "+ routine" opens a picker over live
   routines not yet linked.
6. **Tasks** — `placementsIn(placements, block, date)` as `TaskRow`s (done toggle works;
   done ones dimmed, TB-16) with a trailing **"at…"** chip: no time → opens a
   start/end picker → `updatePlacement(id, { start, end })`; with time → shows the span,
   tap to change, × to clear the time (keeps the block link). Remove link × →
   `removePlacement`.
7. **+ task** — `TaskPicker`: section "Unplaced {formatDay(date)}" = `unplacedOn(tasks,
   placements, date)`, then "All open tasks" with a search box; pick →
   `addPlacement({ taskId, date, blockId })` (TB-15 handled by the store).
8. Footer: "Remove from this week on" / "Delete" per §2.

### 5.4 Placement sheet — `src/components/PlacementSheet.tsx`

Path B and the phone form (TB-13). Props `{ placementId: string | null, date, preset?: { start, end, taskId? } }`.
Fields: task (TaskPicker, same component), day, start, end, optional "in block"
(blocks on that day, or none). "Add" → `addPlacement`. Existing: edit in place, "Remove".

### 5.5 Task picker — `src/components/TaskPicker.tsx`

Reused by both sheets. Excludes done and archived tasks, shows Space dot + title +
due chip, keyboard-navigable list, search over title.

### 5.6 Home — `src/views/home/`

- `TodayStrip.tsx`: one `DayRow` for today with no label and no tray, hour ticks
  underneath (00 · 06 · 12 · 18 · 24), badge-only bars (TB-21), the now-line; bars open
  `openBlock` / the placement sheet. Below it one line: **Now** · `currentBlock` name
  and "until HH:MM", or "Open time until HH:MM" (next block start) — this is not a
  computed total, it is the current block, and it is what makes the strip useful at a
  glance. Rendered only when today has any block or placement; otherwise a single
  "Plan your week →" link to `/week`.
- `HomeView.tsx`: order becomes strip → Today → Overdue → Routines → Pinned → In
  progress (TB-20). `homeSections` is unchanged; only the JSX order moves. Update the
  doc comment and `CONTEXT.md`.
- `HomeTaskRow.tsx`: new optional `hour?: string` in `meta` ("16:00–17:00") from the
  task's timed placement today, or the block name when only linked.
- `RoutineRow.tsx`: optional `at?: string` ("06:00") = the earliest block today whose
  `routineIds` includes the routine.

### 5.7 Task editor

`TaskEditor.tsx`: under Scheduled, a read-only line **Placed** listing
`placedDays` with spans ("Sat 27 Sep 16:00–17:00 · in Thesis"), and a warn-tone hint
"Scheduled {day}, not placed" when `unplacedOn` would list it (TB-17). No editing here.

### 5.8 Desktop drag — `useRulerDrag.ts` (P4)

Enabled only when `matchMedia('(pointer: fine)')`. On the ruler div:

- **Create**: pointerdown on empty ruler → track → on pointerup with `|Δ| ≥ STEP` show
  a small popover at the release point: **New block** (→ `BlockSheet` new mode with
  start/end/weekday preset) / **Place a task** (→ `PlacementSheet` with the span).
  Draws a ghost bar while dragging.
- **Move**: pointerdown on a `BlockBar`/`PlacementBar` body → drag → on release
  `updateBlockFrom(id, week, { start, end })` / `updatePlacement`. Click without
  movement opens the sheet as before.
- **Resize**: 6px edge handles (`cursor: ew-resize`) on both bar kinds.
- Snap every position with `snap()`; clamp inside the day; a bar never inverts.
- `setPointerCapture` on the ruler; ignore secondary buttons.

## 6. MCP / server (P5)

- `server/tools.ts` `today`: add `blocks: [{ name, start, end, routines: [titles], tasks: [taskViews] }]`
  for `blocksOn(date)`, `placements: [...]` for timed placements not in a block, and
  `now: { name, until } | null` when `date === today()` (uses the clock). Routine view
  gains `at` when linked. `INSTRUCTIONS` gets one sentence on Blocks and Placements.
- `cli/brian.ts` `printToday`: print the `now` line and the blocks list above the
  routines.
- No write tools in v1 (TB-23). Added after v1: `list_blocks`, `create_block`,
  `update_block` (from a week on, TB-5), `delete_block` (from a week on, or
  `everywhere`). They apply the same placement revisions as the store
  (`domain/block.ts`: `buildBlock`, `repointPlacements`, `movePlacements`,
  `unlinkPlacements`, `removePlacementsOf`), so a Block changed from a chat is
  indistinguishable from one changed in the sheet.

## 7. Tests

- `src/domain/block.test.ts`: every function in §1; especially `appliesTo` at the
  boundaries, `splitAt`, `overlapRegions`, `scheduledFromPlacements`, `unplacedOn`,
  `isStalePlacement`, `currentBlock` at exactly `end`.
- `src/store/blocks.test.ts` (new; the stores are testable without React):
  `updateBlockFrom` splits once and re-points only `date >= week` placements;
  `setCarry(false)` in week W leaves W and removes W+1; `removeBlock` unlinks timed
  placements and removes untimed ones; `addPlacement` writes `scheduled` = earliest;
  `removePlacement` never clears `scheduled`.
- `src/sync/merge.test.ts`: round-trip of the two kinds; the three repairs in §3.
- `server/tools.test.ts`: `today` reports `now` and `blocks`.

## 8. Phases and ownership

Baseline: `17ea4c2` on `master`. P0 lands first, serially. P1–P3 run in parallel from
P0's commit in worktrees (`git worktree add ../bt-week -b feat/week`, etc.; `npm install`
in each). P4 branches from P1's merge. P5 and P6 close.

| Phase | Owns | Depends on |
|---|---|---|
| **P0 Foundation** | `src/domain/block.ts` + test, `src/store/blocks.ts` + test, `tombstones.ts`, `repository.ts`, `migrate.ts`, `persist.ts`, `sync/merge.ts` + test, `sync/engine.ts`, `server/index.ts` (KINDS), `server/records.ts`, `CONTEXT.md`, ADR 0003, `App.tsx` route + `Shell.tsx` nav/context with **stub** `WeekView`, `BlockSheet`, `PlacementSheet`, `TodayStrip`, `TaskPicker` (each a component that renders its name) | — |
| **P1 Week page** | `src/views/week/*` (except `useRulerDrag.ts`), `icons.tsx` (WeekIcon), palette tuning in `block.ts` colours only | P0 |
| **P2 Sheets** | `BlockSheet.tsx`, `PlacementSheet.tsx`, `TaskPicker.tsx`, `TaskEditor.tsx` (Placed line) | P0 |
| **P3 Home** | `src/views/home/*`, `RoutineRow.tsx`, `HomeTaskRow.tsx` | P0. Uses `DayRow` from P1 — until P1 merges, P3 renders its own minimal bars and swaps at integration. |
| **P4 Drag** | `useRulerDrag.ts`, hooks into `DayRow`/`BlockBar`/`PlacementBar` | P1, P2 |
| **P5 MCP** | `server/tools.ts`, `server/tools.test.ts`, `cli/brian.ts` | P0 |
| **P6 Integration** | merge, `npm run build && npm test && npm run lint`, verify v3→v4 migration on a real `brian-tasks:v3` localStorage, walk TB-1…TB-23 in the running app on phone width and desktop, fix seams | all |

Each parallel session's opening prompt: *"Read CONTEXT.md, docs/adr/0001, and
docs/time-blocks.md. You are session P<N>. Only touch the files listed as yours in §8.
Cite agreement items as (TB-n) in comments where a rule is implemented."*

## 9. Acceptance walk (P6)

1. Fresh device: Week page shows an empty week, legend empty, every row a tray-less gap.
2. Phone: tap "Mon" → new block "Gym" 06:00–07:45, carry on → appears Mon; navigate
   › next week → still there; ‹ back to the week before creation → not there (TB-4/5).
3. Desktop: drag Tue 09:00→17:00 → "New block" → "Job", carry on. Edit Job to 08:30 in
   week+1 → week+1 and later show 08:30, this week shows 09:00 (TB-5).
4. Link Routine "Gym" to the Gym block → next week's Gym block still lists it (TB-9).
   Check in from the sheet on today only.
5. Board: schedule "Thesis ch. 5" for Saturday → Sat tray shows it (TB-18). Tap it →
   picker → put in "Personal time" block → tray empties, block shows the title (TB-21).
   "at…" 16:00–17:00 → drawn hatched over the block (TB-11/12).
6. Task editor shows "Placed Sat 27 Sep 16:00–17:00 · in Personal time". Change
   Scheduled to Monday → placement stays, Mon tray lists the task, Saturday bar shows
   the mismatch hint (TB-17).
7. Complete the task on Home → the Saturday bar dims and strikes through (TB-16).
8. Home: strip on top with the now-line, "Now · Job until 17:00", Today rows carry
   hours, Routine rows carry "06:00" (TB-20).
9. Second device (or a second browser profile): everything above arrives; delete a
   block on one side → gone on the other; a placement made offline survives a reload.
10. `brian today` prints the blocks and the current one.
