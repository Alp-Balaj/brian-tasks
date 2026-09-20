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

The app runs without the server (everything works from local storage; the badge shows "Offline"). `npm link` puts the `brian` CLI on your PATH (see below). `API_PROXY=https://brian-tasks-production.up.railway.app npm run dev` proxies `/api` to production instead, which signs the localhost tab in against the real server — handy to seed it from a browser that already holds data.

## Layout

```
src/
  domain/task.ts        Task model, statuses, priorities. No UI/storage deps.
  domain/space.ts       Space model, DEFAULT_SPACE_ID ('personal'), ALL_SPACES, the colour palette, nextFreeColour.
  domain/routine.ts     Routine model + schedule/streak logic (isScheduledOn, currentStreak, ...).
  domain/block.ts       Blocks (versioned weekly rules, ADR 0003) and Placements: weekOf, appliesTo, splitAt, blocksOn, unplacedOn, ...
  store/repository.ts   Snapshot { tasks, spaces, routines, checkIns, blocks, placements, tombstones } <-> localStorage.
  store/migrate.ts      One-time v1 -> v2 -> v3 -> v4 migrations.
  store/tasks.ts        Zustand store: add/update/remove/move/archive/restore/togglePin.
  store/spaces.ts       Spaces: add/update/reorder/remove (remove moves Tasks to Personal).
  store/routines.ts     Routines + Check-in records; `routine.checkIns` is derived from the records.
  store/blocks.ts       Blocks + Placements: updateBlockFrom splits at the week (TB-5); Task.scheduled follows the earliest placement.
  store/tombstones.ts   Deletions not yet told to the server.
  store/ui.ts           Space switcher selection + last-used Space, persisted under brian-tasks:ui.
  store/selectors.ts    useVisibleTasks (non-archived, obeys switcher), archivedTasks.
  sync/merge.ts         The sync model: rows keyed (kind, id), newest updatedAt wins. Pure, tested.
  sync/engine.ts        When to sync and how the result lands in the stores.
  sync/client.ts        The HTTP calls.
  components/           Shell, Sheet, QuickAdd, TaskEditor, BlockSheet, PlacementSheet, TaskPicker, TaskCard, TaskRow, StatusMenu, SpaceSwitcher,
                        ManageSpaces, RoutineEditor, RoutineRow, LoginScreen, SyncBadge.
  components/ui.tsx     Shared controls (CircleCheck, Segmented, Chip, Button…); icons.tsx the inline SVG icons.
  views/home/           Landing page: today's strip of Blocks and Placements, then Today · Overdue · Routines · Pinned · In progress.
  views/week/           Week page: seven day rows 00–24 with Blocks, Placements, hatched overlaps and the unplaced tray per day.
  views/board/          Kanban (dnd-kit). Drag between/within status columns.
  views/list/           Flat list: search, status filter, sort, checkbox to complete.
  views/calendar/       Month grid; tasks appear on `due` / `scheduled`. Day agenda on mobile.
  views/archive/        Archived Tasks (obeys the switcher) and Routines; Restore / Delete.
  domain/home.ts        What Home shows: overdue / today (due, scheduled) / pinned / in progress, each Task once. Pure.
  lib/dates.ts          date-fns helpers; lib/useToday.ts the midnight-rollover hook.
  index.css             Colour tokens (light + dark via prefers-color-scheme); components only name roles.
server/index.ts       Hono server: serves dist/ and the /api routes. Node 24 runs the .ts directly.
server/db.ts          One Postgres table of synced rows; the same newest-wins rule as sync/merge.ts.
server/auth.ts        One shared password -> signed HttpOnly cookie (1 year). Login attempts throttled.
server/mcp.ts         POST /api/mcp: the MCP endpoint Claude and the CLI use. Token-guarded, stateless.
server/tools.ts       The MCP tools (today, list/get/create/update task, list/create/update space, routines, check-in).
server/records.ts     The server's typed view of the rows, for the tools. Writes obey the sync rule.
cli/brian.ts          `brian`: the same tools from a terminal, as an MCP client of /api/mcp.
scripts/import-obsidian.mjs  Vault TaskNotes -> dev/seed.json (dev first run only; never shipped).
```

Terminology (Space, Routine, Check-in, Device, ...) is defined in `CONTEXT.md`; `docs/adr/` records the decisions behind the shape; `docs/research/` holds background reading (e.g. how other task apps do phones); `PLAN.md` records how the work was split across sessions.

## Data

Each Device keeps a full copy in `localStorage` under `brian-tasks:v3` (switcher state under `brian-tasks:ui`, sync cursor under `brian-tasks:sync`) and works offline. Older `v1` / `v2` keys are migrated once on load and left in place.

The server holds the one shared copy in Postgres. A Device catches up on open, about a second after any local change, when connectivity returns, and once a minute while visible: it sends everything it has, the server keeps whatever is newer, and sends back everything that changed since the Device's cursor. Every Task, Space and Routine is compared by `updatedAt` — the later change wins outright (ADR 0001). Deletions travel as tombstones. Check-ins are their own records, so one made on any Device stays made unless explicitly unchecked.

A fresh Device starts empty and fills from the server after sign-in; the first Device to sign in against an empty server seeds it with what it has. To reset a Device: clear site data in the browser.

For `npm run dev` on an empty browser, the app loads `dev/seed.json` if present. Re-generate it from the vault:

```sh
node scripts/import-obsidian.mjs "/home/alpi/Documents/Brian the brain/1 - Managing Brian/Tasks"
```

## Talking to Brian from Claude

The server exposes the app as an MCP server at `https://<host>/api/mcp`, so Claude Code, Claude Cowork, claude.ai and the `brian` CLI can read what is on today and create or change Tasks. Writes land in the same rows table under the same newest-wins rule as a Device's sync, so every Device sees them on its next catch-up (about a minute while open, immediately on open). Tools: `today`, `list_tasks`, `get_task`, `create_task`, `update_task`, `list_spaces`, `create_space`, `update_space`, `list_routines`, `check_in`, `uncheck`. There is no delete: archive Tasks instead; Spaces are only ever deleted in the app.

One long random token guards it (`MCP_TOKEN`; `railway variables --set MCP_TOKEN=...`). It is accepted as `Authorization: Bearer <token>`, or as the last path segment (`/api/mcp/<token>`) for connector UIs that cannot set headers. Wrong tokens are throttled per address, sharing the login throttle. `TZ` decides what "today" means for the tools.

```sh
# Claude Code
claude mcp add --transport http brian https://<host>/api/mcp --header "Authorization: Bearer <token>"

# claude.ai / Cowork: Customize > Connectors > Add custom connector
#   URL  https://<host>/api/mcp    Authentication: No sign-in
#   Request headers: Authorization = "Bearer <token>"   (if your plan shows that section)
#   – or –  URL  https://<host>/api/mcp/<token>          (if it does not)

# Terminal
npm link                                           # once; puts `brian` on PATH
brian config https://<host> <token>                # or BRIAN_URL / BRIAN_TOKEN
brian today
brian add Renew passport --due 2026-10-01 --space Personal --priority high --pin
brian space add University --colour purple
brian ls --space work --status open
brian done <id>
brian check "Read 20 pages"
brian --help
```

The tools and the app build Tasks with the same functions (`domain/task.ts`: `buildTask`, `applyPatch`), so a Task made from a chat is indistinguishable from one made in Quick Add. `docs/adr/0002` has the reasoning.

## Deploy

Hosted on Railway (region `europe-west4`) as one service built from the `Dockerfile`, plus a Railway Postgres. Every push to `master` on GitHub deploys. `railway.json` holds the build/health-check settings.

Service variables:

| Variable         | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `DATABASE_URL`   | Reference to the Postgres service (`${{Postgres.DATABASE_URL}}`) |
| `APP_PASSWORD`   | The one password the login screen accepts            |
| `SESSION_SECRET` | Signs the session cookie; rotating it signs every Device out |
| `MCP_TOKEN`      | What Claude and the `brian` CLI present at `/api/mcp`; rotating it disconnects them |
| `TZ`             | The tools' idea of "today" (e.g. `Europe/Amsterdam`)   |
| `PORT`           | Set by Railway                                       |

Useful commands: `railway logs`, `railway variables`, `railway run npm run server` (local server with production variables), `railway open`.
