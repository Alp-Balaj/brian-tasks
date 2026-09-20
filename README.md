# Brian Tasks

Personal task manager: Home, kanban board, list and month calendar, with Tasks filed into Spaces and daily Routines tracked on Home. Works on desktop and mobile, installs as a PWA, works offline, and keeps every Device in step through a small sync server. Built to be extended day by day.

## Run

```sh
npm install
npm run dev        # http://localhost:5173 — /api is proxied to :3000
npm run server     # sync API + static server on :3000 (reads .env, see .env.example)
npm run build      # tsc + vite build → dist/
npm start          # what production runs: node server/index.ts
npm test           # vitest (domain logic, sync merge)
npm run lint       # oxlint
```

The app runs without the server (everything works from local storage; the badge shows "Offline"). To develop against real data, `railway run npm run server` starts the server with the production variables.

## Layout

```
src/
  domain/task.ts        Task model, statuses, priorities. No UI/storage deps.
  domain/space.ts       Space model, DEFAULT_SPACE_ID ('personal'), ALL_SPACES, SPACE_COLOURS.
  domain/routine.ts     Routine model + schedule/streak logic (isScheduledOn, currentStreak, ...).
  store/repository.ts   Snapshot { tasks, spaces, routines, checkIns, tombstones } <-> localStorage.
  store/migrate.ts      One-time v1 -> v2 -> v3 migrations.
  store/tasks.ts        Zustand store: add/update/remove/move/archive/restore/togglePin.
  store/spaces.ts       Spaces: add/update/reorder/remove (remove moves Tasks to Personal).
  store/routines.ts     Routines + Check-in records; `routine.checkIns` is derived from the records.
  store/tombstones.ts   Deletions not yet told to the server.
  store/ui.ts           Space switcher selection + last-used Space, persisted under brian-tasks:ui.
  store/selectors.ts    useVisibleTasks (non-archived, obeys switcher), archivedTasks.
  sync/merge.ts         The sync model: rows keyed (kind, id), newest updatedAt wins. Pure, tested.
  sync/engine.ts        When to sync and how the result lands in the stores.
  sync/client.ts        The HTTP calls.
  components/           Shell, Sheet, QuickAdd, TaskEditor, TaskCard, SpaceSwitcher, ManageSpaces,
                        RoutineEditor, RoutineRow, LoginScreen, SyncBadge.
  views/home/           Landing page: Routines · Pinned · Today · In progress, across all Spaces.
  views/board/          Kanban (dnd-kit). Drag between/within status columns.
  views/list/           Flat list: search, status filter, sort, checkbox to complete.
  views/calendar/       Month grid; tasks appear on `due` / `scheduled`. Day agenda on mobile.
  views/archive/        Archived Tasks (obeys the switcher) and Routines; Restore / Delete.
  lib/dates.ts          date-fns helpers.
server/index.ts       Hono server: serves dist/ and the /api routes. Node 24 runs the .ts directly.
server/db.ts          One Postgres table of synced rows; the same newest-wins rule as sync/merge.ts.
server/auth.ts        One shared password -> signed HttpOnly cookie (1 year). Login attempts throttled.
scripts/import-obsidian.mjs  Vault TaskNotes -> dev/seed.json (dev first run only; never shipped).
```

Terminology (Space, Routine, Check-in, Device, ...) is defined in `CONTEXT.md`; `docs/adr/` records the decisions behind the shape; `PLAN.md` records how the work was split across sessions.

## Data

Each Device keeps a full copy in `localStorage` under `brian-tasks:v3` (switcher state under `brian-tasks:ui`, sync cursor under `brian-tasks:sync`) and works offline. Older `v1` / `v2` keys are migrated once on load and left in place.

The server holds the one shared copy in Postgres. A Device catches up on open, about a second after any local change, when connectivity returns, and once a minute while visible: it sends everything it has, the server keeps whatever is newer, and sends back everything that changed since the Device's cursor. Every Task, Space and Routine is compared by `updatedAt` — the later change wins outright (ADR 0001). Deletions travel as tombstones. Check-ins are their own records, so one made on any Device stays made unless explicitly unchecked.

A fresh Device starts empty and fills from the server after sign-in; the first Device to sign in against an empty server seeds it with what it has. To reset a Device: clear site data in the browser.

For `npm run dev` on an empty browser, the app loads `dev/seed.json` if present. Re-generate it from the vault:

```sh
node scripts/import-obsidian.mjs "/home/alpi/Documents/Brian the brain/1 - Managing Brian/Tasks"
```

## Deploy

Hosted on Railway (region `europe-west4`) as one service built from the `Dockerfile`, plus a Railway Postgres. Every push to `master` on GitHub deploys. `railway.json` holds the build/health-check settings.

Service variables:

| Variable         | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `DATABASE_URL`   | Reference to the Postgres service (`${{Postgres.DATABASE_URL}}`) |
| `APP_PASSWORD`   | The one password the login screen accepts            |
| `SESSION_SECRET` | Signs the session cookie; rotating it signs every Device out |
| `PORT`           | Set by Railway                                       |

Useful commands: `railway logs`, `railway variables`, `railway run npm run server` (local server with production variables), `railway open`.
