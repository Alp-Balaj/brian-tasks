# Brian Tasks

Personal task manager: Home, kanban board, list and month calendar, with Tasks filed into Spaces and daily Routines tracked on Home. Works on desktop and mobile. Built to be deployed as a static web app and extended day by day.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
npm test           # vitest (domain logic)
npm run lint       # oxlint
```

## Layout

```
src/
  domain/task.ts        Task model, statuses, priorities. No UI/storage deps.
  domain/space.ts       Space model, DEFAULT_SPACE_ID ('personal'), ALL_SPACES, SPACE_COLOURS.
  domain/routine.ts     Routine model + schedule/streak logic (isScheduledOn, currentStreak, ...).
  store/repository.ts   Snapshot { tasks, spaces, routines } <-> localStorage. Swap for a backend here.
  store/migrate.ts      One-time v1 -> v2 migration (archived tag -> flag, everything into Personal).
  store/tasks.ts        Zustand store: add/update/remove/move/archive/restore/togglePin.
  store/spaces.ts       Spaces: add/update/reorder/remove (remove moves Tasks to Personal).
  store/routines.ts     Routines: add/update/archive/restore/checkIn/uncheck.
  store/ui.ts           Space switcher selection + last-used Space, persisted under brian-tasks:ui.
  store/selectors.ts    useVisibleTasks (non-archived, obeys switcher), archivedTasks.
  components/           Shell, Sheet, QuickAdd, TaskEditor, TaskCard, SpaceSwitcher, ManageSpaces,
                        RoutineEditor, RoutineRow.
  views/home/           Landing page: Routines · Pinned · Today · In progress, across all Spaces.
  views/board/          Kanban (dnd-kit). Drag between/within status columns.
  views/list/           Flat list: search, status filter, sort, checkbox to complete.
  views/calendar/       Month grid; tasks appear on `due` / `scheduled`. Day agenda on mobile.
  views/archive/        Archived Tasks (obeys the switcher) and Routines; Restore / Delete.
  lib/dates.ts          date-fns helpers.
scripts/import-obsidian.mjs  Vault TaskNotes -> public/seed.json (loaded on first run only).
```

Terminology (Space, Routine, Check-in, Pinned, Archived, ...) is defined in `CONTEXT.md`; `PLAN.md` records how the work was split across sessions.

## Data

Tasks, Spaces and Routines are stored together in `localStorage` under `brian-tasks:v2` (switcher state under `brian-tasks:ui`). A browser that still has the older `brian-tasks:v1` key is migrated once on load — every Task into the Personal Space, the `archived` tag turned into the archived flag — and v1 is left in place. On first run (empty storage) the app loads `public/seed.json` if present, through the same migration. To reset: clear site data in the browser.

Re-generate the seed from the vault:

```sh
node scripts/import-obsidian.mjs "/home/alpi/Documents/Brian the brain/1 - Managing Brian/Tasks"
```

## Deploy

`npm run build` produces a static `dist/`. Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages, nginx). The app uses client-side routing, so configure the host to serve `index.html` for unknown paths.
