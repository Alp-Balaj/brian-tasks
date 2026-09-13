# Brian Tasks

Personal task manager: kanban board, list, and month calendar. Works on desktop and mobile. Built to be deployed as a static web app and extended day by day.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
```

## Layout

```
src/
  domain/task.ts        Task model, statuses, priorities. No UI/storage deps.
  store/repository.ts   TaskRepository interface + localStorage adapter. Swap for a backend here.
  store/tasks.ts        Zustand store: add/update/remove/move + pure selectors.
  components/           Shell (nav + responsive frame), Sheet, QuickAdd, TaskEditor, TaskCard.
  views/board/          Kanban (dnd-kit). Drag between/within status columns.
  views/list/           Flat list: search, status filter, sort, checkbox to complete.
  views/calendar/       Month grid; tasks appear on `due` / `scheduled`. Day agenda on mobile.
  lib/dates.ts          date-fns helpers.
scripts/import-obsidian.mjs  Vault TaskNotes -> public/seed.json (loaded on first run only).
```

## Data

Tasks are stored in `localStorage` under `brian-tasks:v1`. On first run (empty storage) the app loads `public/seed.json` if present. To reset: clear site data in the browser.

Re-generate the seed from the vault:

```sh
node scripts/import-obsidian.mjs "/home/alpi/Documents/Brian the brain/1 - Managing Brian/Tasks"
```

## Deploy

`npm run build` produces a static `dist/`. Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages, nginx). The app uses client-side routing, so configure the host to serve `index.html` for unknown paths.
