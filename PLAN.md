# Parallel implementation plan — Spaces, Archived, Routines, Home

Source of truth for *what* is being built: `CONTEXT.md` (glossary) and the design
agreement artifact (31 decisions, Q1–Q31). This file is the *how*: who touches which
file, in what order, so several Claude Code sessions can work at once without merging
each other's work by hand.

Baseline: `11cddb3` on `master`.

## Shape of the work

Almost every feature touches the same four small files (`domain/task.ts`,
`store/tasks.ts`, `store/repository.ts`, `Shell.tsx`). Running four sessions against
those from the start would just make four sessions merge the same 100 lines. So:

1. **S0 — Foundation** (one session, serial). Data model, migration, stores, routes,
   nav, editor fields. Nothing pretty; everything typed. Commit to `master`.
2. **S1–S4 in parallel** (four sessions, four worktrees, branched off S0's commit).
   Each owns a disjoint set of files (ownership table below).
3. **S5 — Integration** (one session). Merge, run the app, verify migration on a real
   `brian-tasks:v1` localStorage, fix seams.

Expected critical path: S0 → longest of S1–S4 → S5.

## Worktrees

```sh
# after S0 has landed on master
git worktree add ../bt-spaces   -b feat/spaces
git worktree add ../bt-routines -b feat/routines
git worktree add ../bt-home     -b feat/home
git worktree add ../bt-archive  -b feat/archive
# in each: npm install (node_modules is not shared), then `claude`
```

Each parallel session's opening prompt: *"Read PLAN.md. You are session S<N>. Only
touch the files listed as yours. Do not touch domain/ or store/ except where the table
says so."*

---

## S0 — Foundation (serial, must land first)

Goal: every store hook, type, route and selector that S1–S4 will import exists and is
committed, so the four streams compile against a fixed contract. No new visuals beyond
stubs and plain form controls.

### Domain

`src/domain/task.ts` — add to `Task`:

```ts
spaceId: string     // always set; DEFAULT_SPACE_ID after migration
archived: boolean   // replaces the `archived` tag (Q5)
pinned: boolean     // hand-picked for Home (Q12, Q25)
```

`src/domain/space.ts` (new):

```ts
export interface Space { id: string; name: string; colour: string; order: number }
export const DEFAULT_SPACE_ID = 'personal'
export const ALL_SPACES = 'all' as const
export type SpaceSelection = string | typeof ALL_SPACES   // a space id, or 'all'
export const SPACE_COLOURS: readonly string[]             // ~8 hex values for the picker
```

`src/domain/routine.ts` (new) — types only; S2 adds the pure functions:

```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6          // date-fns getDay(): 0 = Sunday
export type Schedule = { kind: 'daily' } | { kind: 'weekdays'; days: Weekday[] }
export interface Routine {
  id: string
  title: string
  schedule: Schedule
  note: string            // "currently: Peak"
  archived: boolean
  checkIns: ISODate[]     // sorted ascending, unique
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
export type NewRoutine = Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }
export type RoutinePatch = Partial<Omit<Routine, 'id' | 'createdAt'>>
```

### Persistence + migration

`src/store/repository.ts` — the repository now loads/saves one snapshot:

```ts
export interface Snapshot { tasks: Task[]; spaces: Space[]; routines: Routine[] }
export interface Repository { load(): Promise<Snapshot | null>; save(s: Snapshot): Promise<void> }
```

Storage key `brian-tasks:v2`. On load, if `v2` is absent and `brian-tasks:v1` exists,
migrate it and save as v2 (leave v1 in place). The seed (`public/seed.json`, 104 tasks)
goes through the same migration on first run.

`src/store/migrate.ts` (new): `migrateV1(tasks: unknown[]): Snapshot`

- every task gets `spaceId: DEFAULT_SPACE_ID`, `pinned: false`
- `archived = tags.includes('archived')`; remove that tag from `tags` (Q5, Q31 — 7 seeded tasks, some still `hold`)
- `spaces = [{ id: 'personal', name: 'Personal', colour: SPACE_COLOURS[0], order: 0 }]`
- `routines = []`

### Stores (public API that S1–S4 code against)

Keep them as separate zustand stores or slices — S0's call — but the hooks below must
exist with these names and signatures.

`useTasks` (`src/store/tasks.ts`) — existing API plus:

- `add(input)` requires `spaceId` in `NewTask` (defaults to `DEFAULT_SPACE_ID` only as a fallback)
- `update(id, patch)`: when status becomes `done`, also set `pinned: false` (Q25)
- `move(...)`: same unpin-on-done rule
- `archive(id)`, `restore(id)`, `togglePin(id)`
- `remove(id)` stays = permanent delete

`useSpaces` (`src/store/spaces.ts`, new):

- `spaces: Space[]` (sorted by `order`)
- `add(name, colour): Space`, `update(id, patch)`, `reorder(ids: string[])`
- `remove(id)`: refuses for `DEFAULT_SPACE_ID`; moves that space's tasks to the default space (Q16)

`useRoutines` (`src/store/routines.ts`, new):

- `routines: Routine[]`
- `add(input: NewRoutine): Routine`, `update(id, patch)`, `remove(id)`
- `archive(id)`, `restore(id)`
- `checkIn(id, date: ISODate)`, `uncheck(id, date: ISODate)` — the store does not enforce "today only"; the UI does (Q22)

`useSpaceSelection` (`src/store/ui.ts`, new; persisted under `brian-tasks:ui`, Q3):

- `selected: SpaceSelection` (default `DEFAULT_SPACE_ID`), `select(sel)`
- `lastUsedSpaceId: string`, `setLastUsed(id)` — updated whenever a task is created (Q18)

`useVisibleTasks()` (`src/store/selectors.ts`, new): non-archived tasks, filtered by the
current selection (`'all'` → every space). **Board, List, Calendar switch to this hook
in S0** — one-line change each. That makes archived-hiding live immediately and makes
the switcher work the moment S1 renders it.

Also export pure helpers from `selectors.ts`: `visibleTasks(tasks, selection)`,
`archivedTasks(tasks, selection)`.

### Hydration

`App.tsx` hydrates all three stores from one `repo.load()`; each mutation saves the
combined snapshot. Simplest: one `persist()` helper that reads the three stores and
calls `repo.save`.

### Routes, nav, stubs

`App.tsx`: index → `/home`; add `/home` and `/archive`; `*` → `/home` (Q14).

`Shell.tsx`:

- `NAV` = Home, Board, List, Calendar — these four are the mobile tabs (Q29)
- Archive appears in the desktop sidebar only, below the four
- render `<SpaceSwitcher />` (from `components/SpaceSwitcher.tsx`) in the sidebar and in
  the mobile header; S0 ships a stub that renders a plain `<select>`; S1 replaces it

Stub files S0 creates (so the branches don't conflict on "who creates it"):

| File | Stub content | Owner after S0 |
|---|---|---|
| `src/views/home/HomeView.tsx` | renders `<RoutinesSection />` + "Home" heading | S3 |
| `src/views/home/RoutinesSection.tsx` | `return null` | S2 |
| `src/views/archive/ArchiveView.tsx` | "Archive" heading | S4 |
| `src/components/SpaceSwitcher.tsx` | plain `<select>` over `useSpaces` + All | S1 |

`ListView.tsx`: add a footer link to `/archive` under the count (Q29). S1 will also
touch ListView (colour dot) — keep this one line at the bottom to avoid overlap.

### TaskEditor (S0 does all three so S1/S3/S4 don't fight over one file)

- Space `<select>` over `useSpaces`
- "Pinned to Home" checkbox → `togglePin`
- Replace the **Delete** button with **Archive** (calls `archive`, closes the sheet).
  Permanent delete only exists on the Archive page (Q28).

### Definition of done for S0

- `npm run build` and `npm run lint` clean
- Fresh browser: seed loads, 7 tasks are `archived: true` and no task carries the
  `archived` tag, all in Personal, Home is the landing page
- Browser with old `brian-tasks:v1`: same result via migration
- Board/List/Calendar no longer show archived tasks
- Commit on `master`; include this `PLAN.md` in the commit so worktrees can read it

---

## S1 — Spaces UI (`feat/spaces`)

Owns: `components/SpaceSwitcher.tsx`, `components/ManageSpaces.tsx` (new),
`components/QuickAdd.tsx`, `components/TaskCard.tsx`, and the row rendering in
`views/list/ListView.tsx`, `views/board/BoardView.tsx`, `views/calendar/CalendarView.tsx`.

- **Switcher** (Q3, Q4, Q15): lists spaces with colour dot, plus "All spaces"; selection
  is `useSpaceSelection`. Last entry: "Manage spaces…". Visible on every page; Home just
  doesn't read it.
- **Manage spaces** (Q16, Q17): a `Sheet` with create (name + colour from
  `SPACE_COLOURS`), rename, reorder (dnd-kit sortable is already a dependency; up/down
  buttons are acceptable), delete with confirm ("Tasks move to Personal"). Default space
  cannot be deleted.
- **QuickAdd** (Q18): if `selected !== 'all'` file into it silently. If `'all'` or the
  current route is `/home`, show a space `<select>` preselected to `lastUsedSpaceId`.
  Always call `setLastUsed`.
- **Colour dot** (Q30): `TaskCard` and List rows show the space colour dot only when
  `selected === 'all'`. Keep the existing priority dot; don't invent a second visual
  language. Calendar compact cards: colour dot only if it fits, otherwise skip.

Don't touch: `views/home/*`, `views/archive/*`, `TaskEditor.tsx`, `domain/*`, `store/*`.

---

## S2 — Routines (`feat/routines`)

Owns: `domain/routine.ts` (adding functions below the types), `views/home/RoutinesSection.tsx`,
`components/RoutineEditor.tsx` (new), `components/RoutineRow.tsx` (new). May add
`vitest` as a devDependency plus `src/domain/routine.test.ts` — the streak rules are the
only logic in this whole plan that is easy to get subtly wrong.

Pure functions to add in `domain/routine.ts`:

```ts
export function isScheduledOn(schedule: Schedule, date: Date): boolean
export function hasCheckIn(routine: Routine, date: ISODate): boolean
/** Q9/Q22: consecutive scheduled days with a check-in, ending today or yesterday.
 *  Unscheduled days are skipped. Today without a check-in does not break it. */
export function currentStreak(routine: Routine, today: Date): number
export function isMissed(routine: Routine, date: Date, today: Date): boolean  // scheduled, past, no check-in
```

Test cases from the artifact: Mon/Wed/Fri routine, check-ins Mon+Wed, today Fri
unchecked → 2; Fri checked → 3; today Sat (off) with Fri missed → 0; today Mon next
week with Fri missed → 0; daily routine, checked every day through yesterday → n.

UI (Q10, Q21, Q23):

- `RoutinesSection`: header "Routines · today", one `RoutineRow` per non-archived routine
  scheduled today, "+ routine" button. Hidden entirely when there are no routines
  scheduled today *and* no routines at all; if routines exist but none are scheduled
  today, still show the "+ routine" affordance (otherwise there's no way to reach them).
- `RoutineRow`: checkbox bound to today's check-in (`checkIn`/`uncheck` with
  `toISODate(new Date())`), title, streak badge "▲ n", tap on title opens `RoutineEditor`.
- `RoutineEditor` in a `Sheet`, saves immediately like `TaskEditor`: title, schedule
  (Every day / weekday toggles), note, Archive button. No back-fill UI (Q22).
- "Today" = `new Date()` at render; the section should re-render across midnight if left
  open (a 60 s interval on the date string is enough — Q11).

Don't touch: `HomeView.tsx` (S3 owns it; it already renders your section),
`store/routines.ts` (ask in S5 if the API is missing something), `Shell.tsx`.

---

## S3 — Home (`feat/home`)

Owns: `views/home/HomeView.tsx`, `views/home/homeSections.ts` (new, pure selectors),
`views/home/HomeTaskRow.tsx` (new).

`homeSections(tasks, today: ISODate)` → `{ pinned, today, inProgress }` from **all**
non-archived tasks across every space (Q3 — do not use `useVisibleTasks`, read
`useTasks` and filter `!archived` yourself):

- `pinned`: `pinned && status !== 'done'`
- `today`: `due === today || scheduled === today || (due < today && status !== 'done')`;
  each row knows whether it's `overdue`, `due today`, or `scheduled`
- `inProgress`: `status === 'in-progress'`
- A task can appear in more than one section; that's fine (wireframe shows it).

Layout (Q24): sections in order Routines · Pinned · Today · In progress, each hidden
when empty. Routines is `<RoutinesSection />` from S2 — import it, don't implement it.
`HomeTaskRow`: space colour dot (always — Q30), title, tag chip (`overdue` in warn
colour / `due today` / `scheduled`), unpin icon in the Pinned section (`togglePin`),
click opens `openTask` via `useShell`. No checkbox on Home rows unless it's cheap; the
editor is one tap away.

Empty state when all four sections are empty: one calm line, not an illustration.

Don't touch: `RoutinesSection.tsx`, `TaskEditor.tsx`, `Shell.tsx`, `store/*`.

---

## S4 — Archive (`feat/archive`)

Owns: `views/archive/ArchiveView.tsx`, `views/archive/ArchiveRow.tsx` (new).

- Two sections (Q26): **Tasks** (from `archivedTasks(tasks, selected)` — obeys the
  switcher, Q27) and **Routines** (all archived routines, switcher irrelevant, Q20).
- Row: title, secondary line (status/priority/space name for tasks; schedule summary for
  routines), two actions: **Restore** and **Delete** (permanent, `confirm()` first — Q28).
- Empty states per section. Colour dot on task rows only when `selected === 'all'`.
- No route/nav work — S0 already wired `/archive`, the sidebar entry and the List footer link.

Don't touch anything outside `views/archive/`.

---

## S5 — Integration (after S1–S4 are pushed)

1. Merge in this order to keep conflicts near zero: `feat/routines` (may touch
   `package.json` for vitest), `feat/home`, `feat/archive`, `feat/spaces`.
2. `npm install && npm run build && npm run lint` (and `npx vitest run` if added).
3. Walkthrough against the artifact's rules, one line per row — the "Views × switcher"
   matrix and the Mon/Wed/Fri streak example are the acceptance tests:
   - switcher governs Board/List/Calendar/Archive; Home ignores it
   - colour dot: Home always; elsewhere only in All spaces
   - QuickAdd from All spaces or Home shows the picker, preselected to last used
   - deleting a space moves its tasks to Personal
   - completing a pinned task unpins it
   - archived task on hold with high priority appears nowhere but Archive
   - un-check today works; no way to check a past day
   - old `brian-tasks:v1` storage migrates once; v2 is used afterwards
4. Update `README.md` layout section and `CONTEXT.md` if any term drifted.
5. `git worktree remove` the four worktrees; delete merged branches.

## Ownership at a glance

| Path | S0 | S1 | S2 | S3 | S4 |
|---|---|---|---|---|---|
| `domain/task.ts`, `domain/space.ts` | create/edit | — | — | — | — |
| `domain/routine.ts` | types | — | functions | — | — |
| `store/*` | all | — | — | — | — |
| `App.tsx`, `Shell.tsx`, `TaskEditor.tsx` | all | — | — | — | — |
| `SpaceSwitcher.tsx`, `ManageSpaces.tsx`, `QuickAdd.tsx`, `TaskCard.tsx` | stub switcher | own | — | — | — |
| `views/board`, `views/list`, `views/calendar` | hook swap + list footer | colour dot | — | — | — |
| `views/home/HomeView.tsx`, `homeSections.ts`, `HomeTaskRow.tsx` | stub | — | — | own | — |
| `views/home/RoutinesSection.tsx`, `RoutineEditor.tsx`, `RoutineRow.tsx` | stub | — | own | — | — |
| `views/archive/*` | stub | — | — | — | own |
| `package.json` | — | — | vitest only | — | — |

If a stream finds the S0 contract is missing something it needs, the rule is: work
around it locally in your own files, leave a `// S5:` comment, and raise it at
integration — don't edit `store/` on a feature branch.
