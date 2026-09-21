# Planning the day — agreement and implementation plan

Two parts, in the shape of `docs/time-blocks.md`. **Part 1** is the feature agreement
for the second batch of additions chosen from `docs/research/timo-and-productivity-
features.md` on 2026-09-21 (everything on that shortlist except natural-language Quick
Add, which the user declined); the numbered items are the ids to cite in code comments
(`(PD-4)`). **Part 2** is the technical plan: data model, sync, files, phases, and a
session ownership table.

The four open questions from the shortlist were settled by Claude at the user's
request; each is marked *(settled)* with its reasoning so it can be overturned in one
place.

A new session should read `CONTEXT.md`, `docs/adr/0001`, `docs/time-blocks.md` (for the
Week vocabulary), this file, and then only the phase it owns.

---

# Part 1 — Feature agreement

**Purpose.** Let Brian — and Claude through the MCP server — plan a day, close it, and
look back on a week, without adding a timer, a ledger, a goal, or a second list. Every
addition below extends a concept that already exists; none introduces a new page.

## Tasks

- **PD-1 Estimate.** A Task may carry an **Estimate**: how long one sitting of it is
  expected to take, in minutes, a multiple of 15. Chosen from chips (15m, 30m, 45m, 1h,
  1h30, 2h, 3h, 4h) or typed. Shown as a small "1h" on rows and in the tray. **Never
  summed** anywhere on screen (TB-2 stands: open time is seen, not computed).
- **PD-2 Estimate sizes a Placement.** *(settled)* When a Task with an Estimate is
  placed **at an hour** — from the tray, the placement sheet, a desktop drag that only
  fixed a start, or `place_task` — the Placement's end defaults to start + Estimate
  (still snapped, still inside the day). A Task without an Estimate keeps today's
  default of one hour. A drag that fixed both ends keeps both ends. Reasoning: it is the
  one place the number does work instead of being decoration, and it never overrides
  what the user drew.
- **PD-3 Checklist.** A Task may carry a **Checklist**: a flat, ordered list of items,
  each with text and done/not done. Not nested, not Tasks, no dates, no order across
  Tasks. Rows show "2/5" when a Checklist exists. Ticking every item does **not**
  complete the Task; the Task is finished by its own Status, as before.
- **PD-4 Repeat.** A Task may carry a **Repeat**: *every N days / weeks / months /
  years*, anchored to its **Due date** or to its **completion** *(settled: both anchors,
  because rent is due-anchored and "water the plants" is done-anchored; a single anchor
  would misfile one of them)*. A repeating Task must have a Due date; setting a Repeat on
  a Task without one sets Due to today.
- **PD-5 Repeat spawns, never resets.** *(settled)* When a repeating Task becomes
  **done**, it stays done — an honest record, finished exactly once as `CONTEXT.md`
  promises — and a **new Task** is created: same title, description, Priority, Tags,
  Space, Estimate, Repeat and Checklist (all items unticked); Pinned as the finished one
  was before it was done; **no Scheduled**, no Placements; Due = the next occurrence.
  Due-anchored: old Due + interval, advanced until it is after the completion day.
  Done-anchored: the completion day + interval. The finished Task loses its Repeat, so
  reopening it makes it an ordinary Task. Reasoning over reset-in-place: one Task is one
  finish; the Done column and Archive keep the history for free; nothing has to remember
  what "reopen" means for a Task that was reset.
- **PD-6 Where the fields live.** Estimate, Checklist and Repeat are edited in the Task
  editor, below Space and above Tags. Quick Add does not grow (it stays one line);
  `create_task` and `update_task` take all three.

## Placements from the MCP server

- **PD-7** The tools can now put Tasks on days: `list_placements` (a date range),
  `place_task` (a Task on a date, in a Block by name and/or at an hour), `update_placement`
  and `unplace` (one Placement). They follow the placement sheet's rules exactly: at
  least one of Block and hour (D3), Scheduled follows the earliest Placement and is never
  cleared (D9, TB-15, TB-17), and the same Task may be placed any number of times (TB-14).
  This amends TB-23; `docs/time-blocks.md` says so.
- **PD-8 Appointments.** An appointment (dentist Thu 14:00) is a **one-off Block** named
  for it, made with `create_block` (by Claude, from a message or a screenshot) or by hand.
  No calendar import: a Block stays "not an appointment" in the app's vocabulary and open
  time stays honest without a second source of truth. The server instructions say this.

## Closing and deferring

- **PD-9 Close the day.** *(settled)* From **18:00** Device-local time until midnight,
  when anything is still open on Today — a Task due today, Scheduled today, or placed
  today, or any Overdue Task — Home ends with a **Close the day** section. It lists those
  Tasks, each with three actions: **Done**, **Tomorrow**, **Later**. Tomorrow moves the
  date that put the Task on Today (Due if it was due today or overdue, else Scheduled)
  to tomorrow. When every row is dealt with the section says "Day closed" until
  midnight. Nothing is recorded: closing is a state of the day, not a fact about it.
  Reasoning for 18:00 and no nag: it is a ritual, not an alarm; a day that is not
  closed simply becomes tomorrow's Overdue, which Brian already shows first.
- **PD-10 Later.** Every Task row on Home (Today, Overdue, Close the day) and the Task
  editor's date fields get a **Later** action: **Tomorrow · Next week · Pick a day ·
  Unschedule** (the last only when the Task is on Today because it is Scheduled). It moves
  the same date Close the day would. Placements are not touched (TB-17): a Task moved to
  next week with a Placement today is "Scheduled next week, not placed", said as today.
- **PD-11 Plan and close from Claude.** The MCP server offers two **prompts**, `plan_day`
  and `close_day`, that tell Claude the ritual: read `today` (and `list_blocks`,
  `list_placements`), propose Placements for the open time, and only write after the
  user agrees; in the evening, walk the open rows the way Close the day does.

## Looking back

- **PD-12 Week look-back.** The Week page's header carries one quiet line for the week
  on screen once it has begun: **"12 done · Routines 9/14 · 2 stale"** (Tasks completed
  that week across every Space, Check-ins over scheduled Routine-days so far, Placements
  whose Task is not done and whose day has passed). Tap it for a sheet: done Tasks by
  Space, each Routine's checked/scheduled, the stale Placements with one tap to remove
  each. Drawn, not scored; no objectives, no ratings.
- **PD-13 Completed since.** `list_tasks` takes `completed_since` / `completed_until`
  (calendar dates) and, when either is given, defaults `status` to done. A new
  `week_review` tool returns PD-12's numbers and lists for any week, so Claude can write
  the review.
- **PD-14 Routine history.** The Routine editor shows a **month grid** of that Routine:
  each day checked, missed, unscheduled, or not yet, Monday-first, with ‹ › to move
  months. Read-only except today (Q22 stands). `list_routines` takes `days` to include the
  same history for the last N days.

## Reaching things

- **PD-15 Keyboard.** On a keyboard, outside any text field: `n` new Task, `1`–`5` the
  five pages in nav order, `a` Archive, `?` the shortcut list, `Esc` closes the top sheet.
- **PD-16 Jump.** `⌘K` / `Ctrl K` opens **Jump**: type to search open Tasks (title, then
  description) across every Space, ↑↓ to choose, Enter opens the Task editor; the five
  pages match too ("week"). Phone: no Jump (the tab bar is the jump).

## Being told

- **PD-17 Notifications, per Device, opt-in.** *(settled)* A Device can turn
  notifications **on** for itself (a bell next to the sync badge); nothing is sent to a
  Device that has not. Turning it on asks the browser's permission and registers this
  Device with the server together with its **timezone**; the server decides the local
  hour from that. Reasoning: the server already decides "today" for the MCP tools by one
  `TZ`; a phone abroad would otherwise be told about tomorrow at the wrong hour, and only
  the Device knows where it is.
- **PD-18 What is sent.** Two things, both from data that already exists: **a Placement
  at its hour** ("16:00 · Write the report · in Job") when the Task is not done; and a
  **morning line at 08:00** Device-local ("Today: 2 due · 3 scheduled · 1 overdue")
  when there is anything to say. Tapping either opens Home. Nothing else — no streak
  reminders, no due-soon warnings, no "you have not opened the app".

## Deliberately out

- **PD-19** Natural-language parsing in Quick Add or the CLI (declined). Pomodoro or
  any timer, time tracking, summed Estimates, energy levels, templates, a separate
  Inbox, nested sub-Tasks, auto-scheduling, mood or day ratings, calendar import, a
  history of completions for a Repeat beyond the finished Tasks themselves, and
  notifications of any kind other than PD-18.

---

# Part 2 — Technical plan

## 0. Decisions (the "why", short)

| # | Decision | Why |
|---|---|---|
| E1 | `estimate`, `checklist`, `repeat` are **optional fields on `Task`**; no snapshot version bump, no migration, no new sync kind. | A Task without them is a v4 Task. Records are synced whole (ADR 0001), so an old Device simply carries the fields it does not know. |
| E2 | `Estimate` is `Minutes` (integer, multiple of `STEP`), the Week page's unit (D5). | One unit for "how long" everywhere; `snap` already exists. |
| E3 | `ChecklistItem { id, text, done }` with a nanoid `id`. | Items are toggled by id from the MCP tools and the editor; text is not a key. |
| E4 | `Repeat { every, unit, from: 'due' \| 'done' }`; `nextDue(repeat, due, doneOn)` is a pure function in `domain/task.ts`. | PD-4/5 in one place, testable without a store. |
| E5 | Spawning (PD-5) is `completeRepeating(task, tasks, id, now, today) → { done, next }` in the domain; the store's `update`/`move` and the server's `update_task` call it when a Task with a Repeat enters `done`. | The app and Claude finish a repeating Task identically (ADR 0002's rule). |
| E6 | Close the day and Later are **actions on existing fields** (`due`, `scheduled`); no record of a closed day. | PD-9: a state, not a fact. Nothing to sync, nothing to migrate. |
| E7 | Push subscriptions are a **server table**, not a synced kind. | They are per-Device secrets tied to a browser; no other Device should receive them. |
| E8 | The service worker moves from `generateSW` to `injectManifest` (`src/sw.ts`) to add the push handler; precaching is unchanged. | The only way to run code in the worker with vite-plugin-pwa. |
| E9 | Sending is a **one-minute tick** on the server (`server/push.ts`): for every subscription, compute the local `HH:MM` and date from its timezone; send PD-18's two kinds; remember what was sent in memory keyed by `(endpoint, kind, id, date)`, pruned daily. | Simple, stateless across deploys (the worst case after a redeploy is one duplicate in the same minute). A queue or a table would be more machinery than the two notifications deserve. |
| E10 | Jump is a `Sheet` with an input and a list, searched in memory over `useTasks`. | Every Task is already on the Device; no index. |
| E11 | Week look-back and `week_review` share one pure function `weekReview(tasks, routines, blocks, placements, week, today)` in `src/domain/review.ts`. | The page and the tool must agree to the number. |

## 1. Domain — `src/domain/task.ts`

```ts
export interface ChecklistItem { id: string; text: string; done: boolean }
export const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const
export interface Repeat { every: number; unit: RepeatUnit; from: 'due' | 'done' }
export interface Task {
  …
  /** PD-1: one sitting, minutes, multiple of 15. */
  estimate?: Minutes
  /** PD-3: flat, ordered. Absent and [] mean the same. */
  checklist?: ChecklistItem[]
  /** PD-4: requires `due`. */
  repeat?: Repeat
}
export function nextDue(repeat: Repeat, due: ISODate, doneOn: ISODate): ISODate
export function completeRepeating(task: Task, tasks: readonly Task[], nextId: string, now: ISODateTime, today: ISODate): { done: Task; next: Task }
export const describeEstimate = (m: Minutes) => '1h30'
export const describeRepeat = (r: Repeat) => 'Every 2 weeks from completion'
export const checklistProgress = (items?: ChecklistItem[]) => ({ done: 2, total: 5 })
```

`buildTask` copies the three fields when given. It does not know today, so PD-4's
"sets Due to today" is the editor's and the tool's job before they call it.
`applyPatch` is unchanged: spawning is a decision of the caller (E5), because it
produces two Tasks.

Month arithmetic clamps the day (31 Jan + 1 month = 28/29 Feb), stepping in UTC like
`shiftDate` so DST never moves a date.

`src/domain/review.ts` (new): `weekReview(...)` per E11, returning
`{ done: { space: string; tasks: Task[] }[]; routines: { routine; checked; scheduled }[]; stale: Placement[] }`.

`src/domain/home.ts`: `closeDayRows(tasks, placements, today)` — the union PD-9 names,
each with the date field that put it there (`'due' | 'scheduled' | 'placed'`), so Home
and the `close_day` prompt agree on what is open.

## 2. Store

- `store/tasks.ts`: `update` and `move` detect `todo→done` on a Task with `repeat` and
  write both Tasks from `completeRepeating`. New `later(id, when: 'tomorrow' | 'next-week' | ISODate | 'unschedule')` implements PD-10 on top of `update`.
- `store/blocks.ts`: `addPlacement` unchanged; PD-2 is decided by the callers that pick
  a default end (`PlacementSheet`, `useRulerDrag`, the tray, `place_task`) through one
  helper `defaultEnd(start, task, block)` in `domain/block.ts`.
- No persistence change (E1).

## 3. Server

- `server/tools.ts`: `create_task`/`update_task` gain `estimate`, `checklist` (replaces
  the list; items keep their id when the text is unchanged), `repeat` (`null` clears);
  `update_task` calls `completeRepeating` on `done` (E5); views show the three fields;
  `list_tasks` gains `completed_since`/`completed_until` (PD-13); new `list_placements`,
  `place_task`, `update_placement`, `unplace` (PD-7); `week_review` (PD-13);
  `list_routines` gains `days` (PD-14). Prompts `plan_day` and `close_day` (PD-11) via
  `server.registerPrompt`. `INSTRUCTIONS` gains the appointment line (PD-8).
- `server/push.ts` (new): `web-push` with VAPID keys from `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; table `push_subscriptions (endpoint PK, keys
  jsonb, tz text, created_at)`; routes `GET /api/push/key`, `POST /api/push/subscribe`,
  `DELETE /api/push/subscribe` (cookie-guarded); `startPushTick(records)` per E9. A 404 or
  410 from the push service deletes the subscription. Without the env vars the routes
  answer 503 and the tick never starts, so a server without keys behaves as today.

## 4. UI

- `TaskEditor.tsx`: `EstimateField` (chips + minutes input), `ChecklistField` (rows with
  a check, text, remove; Enter adds), `RepeatField` (every N, unit, anchor; "Off").
  `DateField` gains Later (PD-10) through a shared `LaterMenu`.
- `TaskRow`/`TaskCard`/tray chip: "1h", "2/5", "↻" as quiet meta.
- `views/home/CloseDay.tsx` (PD-9) at the bottom of Home; `LaterMenu.tsx` in components.
- `views/week/WeekView.tsx` header line + `ReviewSheet.tsx` (PD-12).
- `RoutineEditor.tsx`: `HistoryGrid` (PD-14).
- `components/Jump.tsx` and `useShortcuts.ts` in `Shell.tsx` (PD-15/16); a
  `ShortcutsSheet` for `?`.
- `components/NotifyToggle.tsx` next to `SyncBadge` (PD-17); `src/push.ts` for the
  subscribe/unsubscribe dance; `src/sw.ts` (E8).
- `CONTEXT.md`: Estimate, Checklist, Repeat, Close the day, Later, Look-back, Jump,
  Notification.

## 5. Tests

`domain/task.test.ts`: `nextDue` (month clamp, advance past completion, year), `completeRepeating`
(fields copied, checklist unticked, pin carried, old loses repeat). `domain/review.test.ts`.
`domain/home.test.ts`: `closeDayRows`. `store/tasks.test.ts`: spawn on `update` and on
`move`, `later`. `server/tools.test.ts`: every new tool and field, `completed_since`,
`place_task` sizing by Estimate (PD-2), prompts listed. `server/push.test.ts`: the tick
picks the right minute per timezone and does not repeat.

## 6. Phases and ownership

Baseline: `7022cc1` on `master`. P0 lands first, serially. P1–P4 may run in parallel
from P0's commit in worktrees. P5 closes.

| Phase | Owns | Depends on |
|---|---|---|
| **P0 Foundation** | `domain/task.ts` + test, `domain/block.ts` (`defaultEnd`), `domain/home.ts` (`closeDayRows`), `domain/review.ts` + test, `store/tasks.ts` + test, `TaskEditor.tsx` fields, `TaskRow`/`TaskCard`/`Tray` meta, `PlacementSheet`/`useRulerDrag` default end, `server/tools.ts` + test (fields, placements, `completed_since`, `week_review`, `days`, prompts), `CONTEXT.md`, `docs/time-blocks.md` TB-23 note | — |
| **P1 Home rituals** | `views/home/CloseDay.tsx`, `HomeView.tsx`, `components/LaterMenu.tsx`, `TaskEditor.tsx` DateField Later | P0 |
| **P2 Look-back** | `views/week/WeekView.tsx` header, `views/week/ReviewSheet.tsx`, `RoutineEditor.tsx` HistoryGrid | P0 |
| **P3 Keyboard** | `components/Jump.tsx`, `components/useShortcuts.ts`, `components/ShortcutsSheet.tsx`, `Shell.tsx` | — |
| **P4 Push** | `server/push.ts` + test, `server/index.ts` routes, `src/sw.ts`, `vite.config.ts`, `src/push.ts`, `components/NotifyToggle.tsx`, `.env.example`, `Dockerfile` if needed | — (uses `records` only) |
| **P5 Integration** | merge, `npm run build && npm test && npm run lint`, README, walk PD-1…PD-18 on phone width and desktop, generate VAPID keys and verify a push on a real phone | all |

## 7. Acceptance walk (P5)

1. Task "Rent", due 1 Oct, repeat every 1 month from due. Mark done on 29 Sep → Rent is
   in Done; a new "Rent" due 1 Nov is at the top of To do, unscheduled, pinned as before.
2. Task with estimate 1h30 dragged from the tray to 14:00 → placed 14:00–15:30. Drag
   drawn 14:00–14:30 → stays 14:30.
3. Checklist 0/3 on a row; tick two in the editor → 2/3; Task still To do.
4. Claude: `place_task` "Write report" Thu 09:00 in Job → the Week page shows it; the
   Task is Scheduled Thu. `unplace` → gone, still Scheduled Thu (TB-17).
5. 18:30 with two open Today rows → Close the day lists both; Tomorrow on one, Done on the
   other → "Day closed".
6. Week header "5 done · Routines 6/9 · 1 stale"; the sheet lists them; removing the
   stale Placement drops the count.
7. Routine editor shows this month's grid, with Sunday unscheduled for a weekday Routine.
8. `⌘K`, type "rep", Enter → the editor opens on "Write report". `?` lists the keys.
9. Phone: bell on → permission → server has one subscription with the phone's timezone;
   a Placement at the next quarter hour → one notification; tap → Home. Bell off → none.
