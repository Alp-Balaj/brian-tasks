# "Timo", and what solo-productivity apps do that Brian does not — research report

(Full report as returned by the research agent, 2026-09-21. Sources: official product sites, help centres, App Store / Product Hunt listings and changelogs only — Cultured Code, Doist, Sunsama, Akiflow, Reclaim, Motion, Morgen, Structured, TickTick, Superlist, Apple, Microsoft, Notion, Amie, Routine, Tiimo, hellotimo.co. Read against `CONTEXT.md`, `README.md`, `PLAN.md` and `docs/time-blocks.md` so nothing already built or explicitly ruled out is re-proposed.)

## 1. What is "Timo"?

Short answer: **"Timo" is not one app.** Four products carry the name, and a fifth (Tiimo) is close enough to be what someone saw. None is a household name; the one most likely to turn up as "a productivity app called Timo" is the freelancer web app at hellotimo.co, and the one most likely to turn up in the iOS App Store today is "Timo Focus" (a screen-time gate). If the user saw it on an Apple "App of the Year" list or an ADHD forum, it was almost certainly **Tiimo**.

| Candidate | What it is | Platforms | Pricing (as listed) | Source |
|---|---|---|---|---|
| **Timo (hellotimo.co)** — "Put your todo list and time tracking in one place" | Todo list where every todo has a built-in timer; time is totalled per day/week/month for timesheets and invoicing. Aimed at freelancers/contractors. | Web + PWA, offline, dark/light | Product Hunt says a lifetime licence exists; site shows no price page. Launched 2018, v2.0 in Jan 2022. | https://hellotimo.co/ · https://hellotimo.co/whats-new/ · https://www.producthunt.com/products/timo-app |
| **Timo Focus: Productive Time** (App Store id 6758259991; search index still shows it as "Timo: Intentional Screen Time") | A gate in front of your apps: apps are locked by default, you declare *what kind of time* and *why* before a timed session, streaks and insights afterwards. | iPhone (iOS 17+), runs on Apple-silicon Mac | Free download; "Timo Pro" in-app $7.99 and $49.99. v1.0 May 2026, v1.0.5 Aug 2026. Developer Lucas Pereira. | https://apps.apple.com/us/app/timo-intentional-screen-time/id6758259991 |
| **Hours tracker – Timo** (App Store id 6749509805) | Shift/hours log with pay rates, tips, overtime, tax rate, CSV export. | iPhone (iOS 17+), Mac | Free; Lifetime $24.99, Yearly $19.99, Weekly $6.99. v1.0 Sep 2025. | https://apps.apple.com/us/app/hours-tracker-timo/id6749509805 |
| **TimO Mobile** (TimO – Time Management Office GmbH) | German enterprise workforce suite: clock in/out, project time, tickets, vacation approvals, CRM, NFC clocking. | iPhone/iPad/Mac/Vision, Android | Free client for a paid corporate system. | https://apps.apple.com/us/app/timo-mobile/id1523307747 · https://play.google.com/store/apps/details?id=com.timomobileapp |
| **Tiimo** (not "Timo", but the obvious near-miss) | Visual daily planner "for every neurotype": colour-coded timeline of the day, routines, focus timer, AI Co-Planner that turns a sentence into steps with time estimates, mood log, widgets. Apple's iPhone App of the Year 2025. | iOS, watchOS, Android, Mac, web | Free tier (apps only); Pro in-app $12/month or $54/year on the US App Store listing; 7-day trial on yearly; family plan. | https://www.tiimoapp.com/ · https://www.tiimoapp.com/faq · https://apps.apple.com/us/app/tiimo-productivity-ai-planner/id1480220328 |

### Core loops and distinctive ideas

**Timo (hellotimo.co).** Make today's todos → press the timer on the one you are doing → at the end of the day/week copy the "day by day log, formatted for easy ⌘C ⌘V" into a timesheet. The changelog is small and slow (multi-device, a Day view, an Overview with per-project filters, passwordless sign-in, system theme). Its one idea is *no context switching between the todo list and the time tracker*; there is no calendar, no scheduling, no recurrence in the official pages. https://hellotimo.co/ https://hellotimo.co/whats-new/

**Timo Focus.** The loop is friction on purpose: "Your apps stay locked by default"; to open one you "choose what kind of time it is, set a timer, and name your reason", then the phone re-locks. Streaks count intentional sessions. It is a screen-time tool, not a task manager. https://apps.apple.com/us/app/timo-intentional-screen-time/id6758259991

**Tiimo.** Plan the day as a vertical, colour-coded timeline of *activities* (not a to-do list); each activity can carry a checklist whose steps have their own countdowns ("Follow the countdown for the step you're on, while keeping completed and upcoming steps in view"); a focus timer makes "time visible"; the Co-Planner "builds step-by-step plans and estimates time for you"; a daily mood check-in; imports Apple/Google/Outlook calendars. https://www.tiimoapp.com/product/visual-planning https://www.tiimoapp.com/faq

### Which of these ideas fit Brian

| Idea | Fit | Why |
|---|---|---|
| Timo's per-task timer and time totals | **No** | `docs/time-blocks.md` states the Week page is "not a time tracker", and TB-2 says open time is "never computed, only seen". Timo is the opposite product. |
| Timo's "one tab, no context switching" | Already Brian's shape | Home + Week + MCP is that. Nothing to add. |
| Timo Focus's "name your reason before you start" | Partial | The honest version for Brian is a Placement: putting a Task at an hour *is* the declared intention. No app-locking. |
| Tiimo's visual day timeline | Already built | Home's today strip and the Week page. |
| Tiimo's AI "turn a sentence into steps with estimates" | **Yes, via MCP** | Brian's MCP server already lets Claude create Tasks; a checklist field and a duration field (below) would let Claude do exactly this without new UI. |
| Tiimo's checklist-with-countdown per step | Half | A plain checklist inside a Task fits; per-step timers do not (adds a timer concept). |
| Tiimo's mood log | **No** | A new daily record type unrelated to Tasks, Routines or Blocks. |
| Tiimo's calendar import | Borderline | See §2.8. |

## 2. Features that would improve a solo user's productivity that Brian lacks

What Brian already has, for reference: Tasks with Status/Priority/Due/Scheduled/Tags/Pinned/Archived in exactly one Space; Routines with weekday schedules, Check-ins and Streaks; Blocks (standing or one-off) and Placements on a Week page; Home; Board/List/month Calendar; Archive; offline PWA with sync; an MCP server (`today`, task/space/routine/block tools, `check_in`) and a CLI. Explicitly out per `docs/time-blocks.md` TB-23: rhythms beyond weekly, computed open-time totals, MCP tools for Placements (Block tools were added later, so that line has already moved once). Already recommended in `docs/research/mobile-task-ui.md`: a "Plan today" pill for overdue triage, swipe gestures, ring-style Routine strip.

### 2.1 Daily planning and shutdown rituals

- **Sunsama** makes planning a guided flow: review yesterday's unfinished ("Mark incomplete items as done or edit past work before moving on"), pull tasks in, check predicted workload against a threshold (the counter "turns yellow when approaching your threshold and red when your planned times exceed" it), order them, optionally timebox to the calendar, "adjust your shutdown time and create a calendar event for it". The shutdown ritual shows the day's tasks with a time breakdown and asks what went well / concerns / obstacles. https://help.sunsama.com/docs/usage-guides/daily-planning/ https://help.sunsama.com/docs/planned-and-actual-times
- **Akiflow** has four Rituals (Daily Planning, Daily Shutdown, Weekly Planning, Weekly Shutdown); Shutdown is "about five minutes": review completed, rate the day, plan tomorrow; timing set under Settings > Rituals. https://product.akiflow.com/help/articles/0805246-rituals
- **Things** frames it as habit, not feature: "Taking a second look at all of the new to-dos in your Inbox daily is an easy yet powerful habit" and "A visit with your to-dos early in the day, every day, is the best way to set your priorities". https://culturedcode.com/things/support/articles/6378414/
- **Microsoft To Do**: "The My Day smart list resets every night, so you have a blank slate"; unfinished items "will be saved to your Tasks list and included in your suggestions the following day". https://support.microsoft.com/en-us/office/my-day-and-suggestions-fc09a1b9-0854-4906-b166-f480ee97a139
- **Routine** (routine.co) explicitly disabled automatic roll-over of unfinished tasks in its Planner and added a Postpone action instead. https://feedback.routine.co/changelog/planner-and-new-console

**Fit for Brian: yes, in a small form.** Brian already refuses to roll over (a Scheduled Task simply becomes Overdue-or-stale); what is missing is the *moment* to deal with it. A "Close the day" step on Home in the evening (each unfinished Today/placed Task: done · tomorrow · unschedule · leave) and the already-recommended "Plan today" in the morning are two buttons, no new concept. Sunsama's workload threshold and Akiflow's day rating do not fit (totals and scores). This is also the single most valuable thing to expose to Claude: an MCP *prompt* ("plan my day" / "close my day") that reads `today` and proposes the edits. Extends: **Home**, **MCP**.

### 2.2 Time-blocking and auto-scheduling

- **Morgen Frames** are "reusable time frames for deep work, meetings, quick wins, and personal time" with a recurrence ("daily, weekdays, custom") and *filters* (source, project, size XS–L, label, energy) so the AI Planner "auto-schedules tasks into the right time blocks"; the plan is previewed ("pulsate over your Frames"), adjusted with sliders, then "click Schedule all", or Esc to discard. https://www.morgen.so/frames https://www.morgen.so/guides/plan-your-day-using-the-ai-planner
- **Akiflow Time Slots**: recurring calendar containers; assign a project (auto-colours), drop tasks in, drag to adjust. https://product.akiflow.com/help/articles/3677363-time-blocking-101
- **Reclaim Habits**: "I want to eat lunch Monday – Friday, anytime between 11:30am and 2pm, for no less than 30m and no more than 1h" — flexible windows, min/max duration, priority, auto-reschedule when overbooked. https://help.reclaim.ai/en/articles/4129152-habits-overview-auto-schedule-flexible-time-for-your-routines
- **Reclaim Tasks**: duration (min 15 min), min chunk, due date (default 3 days out), priority, "Up Next" jumps the queue. https://help.reclaim.ai/en/articles/5108936-tasks-overview
- **Motion**: duration, deadline, priority, start date, chunks; "Motion can schedule it flexibly before the deadline" and spreads chunks "across days instead of blocking your entire calendar". https://www.usemotion.com/help/project-management/task
- **Amie** added "ai scheduling" (auto-reschedule todos with priority/deadline, with break time) in May 2024. https://amie.so/changelog

**Fit for Brian: the algorithm no, the assistant yes.** A standing Block *is* a Morgen Frame without filters; a Placement is the task dropped into it. Motion/Reclaim-style continuous rescheduling contradicts "Open time... never computed, only seen" and would make the Week page move by itself. But the Morgen flow — *propose*, show, confirm — is exactly what Claude over MCP can do if it can create Placements: "here are your unplaced Scheduled Tasks and the open time in your Blocks; put X in Job at 10:00?" The user stays the scheduler. Extends: **Placement**, **Block**, **MCP** (a `place_task`/`unplace_task` pair; TB-23 currently forbids them, but Block tools crossed the same line).

### 2.3 Recurring Tasks

- **Things**: repeat "daily/weekly/monthly/yearly" or "after completion"; each occurrence is a *copy* of a template ("If you are making changes to a repeating to-do but the next time the to-do appears those changes are gone, you have edited the copy"); optional deadline "days earlier". https://culturedcode.com/things/support/articles/2803564/
- **Todoist**: natural-language `every Monday`; `every!` recalculates from the completion date instead of the original date; overdue recurrences skip to the next future date; sub-tasks can reset on the parent. https://www.todoist.com/help/todoist/features/introduction-to-recurring-dates-YUYVJJAV
- **Superlist**: "when repeating tasks are completed, the task gets reopened with a new due date based on the chosen interval". https://help.superlist.com/en/articles/78873-repeating-tasks
- **Structured**: Repeat (Pro) with weekday selection; instances appear on the timeline. https://help.structured.app/en/articles/338114
- **Microsoft To Do**: repeat daily/weekdays/weekly/monthly/yearly/custom; daily repeats get suggested for My Day each morning. https://support.microsoft.com/en-us/office/creating-daily-habits-with-microsoft-to-do-cf2a37ea-8f7b-450c-a401-b131365728b1

**Fit for Brian: yes, but only the "after done" kind.** `CONTEXT.md` already draws the line: a Routine is "never finished, only done-for-today", and lists "Recurring task" under *Avoid*. Daily/weekday repetition is a Routine and must stay one. What Brian cannot express is the monthly or yearly obligation that *is* finished each time (pay rent, renew passport, quarterly tax, service the bike): today the user re-creates it by hand. Things' "after completion" and Todoist's `every!` are the calm version: a Task carries `repeat: { every: N, unit: day|week|month|year }`; marking it done creates one fresh Task with Due (or Scheduled) shifted from the completion date. Each Task is still "finished exactly once". No template entity, no RRULE, no future instances materialised, nothing new on the Week page. Extends: **Task**, `create_task`/`update_task`.

### 2.4 Subtasks / checklists

- **Things**: checklist items inside a to-do, max 100. https://culturedcode.com/things/support/articles/2803573/
- **Apple Reminders**: "Every reminder that you create can have subtasks"; drag one reminder onto another to nest. https://support.apple.com/en-us/102484
- **Microsoft To Do**: "Use steps to break down your larger tasks in to more manageable pieces". https://support.microsoft.com/en-us/office/my-day-and-suggestions-fc09a1b9-0854-4906-b166-f480ee97a139
- **Todoist Task Assist** and **Tiimo Co-Planner** both exist chiefly to *generate* these: "Break task down" → sub-tasks. https://www.todoist.com/help/todoist/todoist-and-ai/introduction-to-todoist-assist-KgPP22q5O https://www.tiimoapp.com/faq

**Fit for Brian: yes as a checklist, no as nested Tasks.** A flat `checklist: { text, done }[]` on a Task keeps one concept and stays out of Board/List/Home counts. Nested Tasks would raise every question Things and Reminders answer with dozens of rules (which Space, which Status, does the parent auto-complete). With the MCP server, this is where Claude's "break it down" lands with zero new UI on Claude's side. Extends: **Task** (`description` already exists; a checklist is its structured sibling).

### 2.5 Natural-language quick add

- **Todoist**: dates, `every`, `#project`, `@label`, `p1`–`p4`, `!reminder`, and `for 2h` duration are all parsed and highlighted as you type. https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz https://www.todoist.com/help/todoist/features/set-a-task-duration-L1kYkZv8d
- **Things Quick Entry**: system-wide Ctrl-Space; "The deadline accepts natural language like 'tomorrow' or 'in 7 days'"; Autofill captures the current web page/email as a note. https://culturedcode.com/things/support/articles/2249437/
- **Apple Reminders**: "Jog every other morning" creates a recurring reminder. https://apps.apple.com/app/reminders/id1108187841
- **Akiflow**: dates and times "using natural language or the shortcut P". https://product.akiflow.com/help/articles/3677363-time-blocking-101
- **Routine's console** shows a summary of the parsed action before committing. https://feedback.routine.co/changelog/planner-and-new-console

**Fit for Brian: yes.** Quick Add today is a title plus chips (Space, Today/Tomorrow, priority). Parsing `tomorrow`, `fri`, `next week`, `!high`, `#work`, `@tag` into the same chips (shown as chips, so the parse is visible and undoable, as Routine and Todoist do) removes taps without adding a concept. Extends: **Task** creation (`QuickAdd.tsx`, and the same parser can serve `brian add`).

### 2.6 Review / weekly reflection

- **Sunsama Weekly Review**: time toward objectives vs other work, "the work you completed for the week and view a time breakdown by day", a written reflection ("big wins, time distractions, and lessons learned"); past reviews are kept. https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-review/
- **Akiflow Weekly Shutdown**: statistics, reflection, goals and notes. https://product.akiflow.com/help/articles/0805246-rituals
- **Things**: "Review this list [Someday] every couple of months"; Areas: "Take a good, hard look at all of them every now and then". https://culturedcode.com/things/support/articles/4001304/

**Fit for Brian: partially.** Objectives, time-by-channel and written reflections are new entities. But the Week page already *is* the record ("Past weeks stay as a record", TB-1); the missing piece is a way to *read* it: done Tasks per Space this week, Routines checked vs scheduled, placements that never got done (TB-16 already draws them stale). A one-screen look-back needs no new data. Over MCP it needs one thing: `list_tasks` accepting `completed_since` (or `status: done` with a date range) so Claude can write the review. Extends: **Week**/**Home**, **MCP**.

### 2.7 Focus timers / Pomodoro

- **TickTick**: "Pomo" (25/5, pause at most three times) and "Stopwatch"; started from a task; statistics by day/week, by list and tag, focus-goal pie charts, Apple Health sync; white noise. https://blog.ticktick.com/2020/05/06/brand-new-focus-experience-ticktick/ https://help.ticktick.com/articles/7055782010496745472
- **Amie**: Pomodoro in the menu bar with audio alerts (Jun 2024). https://amie.so/changelog
- **Tiimo**: countdown per activity and per checklist step; "Make time visible". https://www.tiimoapp.com/faq
- **Sunsama**: Task Timer (Spacebar) records actual time and enters Focus Mode. https://help.sunsama.com/docs/planned-and-actual-times

**Fit for Brian: no as a feature; the Placement already is the timebox.** Every one of these feeds a statistics screen (focused hours, records) — the time-tracking Brian rules out. The only calm equivalent is a "now" marker on today's strip (already drawn) and, optionally, a phone notification when a Placement starts (§2.9). Timo/Tiimo/TickTick all show that once a timer exists, a ledger follows.

### 2.8 Calendar integration (Google / iCal)

- **TickTick** subscribes to third-party calendars for read-only display. https://help.ticktick.com/articles/7055781614550253568
- **Notion Calendar** syncs Google and iCloud and shows Notion database items with start/end as events; "event blocking" mirrors busy time across two calendars. https://www.notion.com/help/guides/getting-started-with-notion-calendar
- **Tiimo Pro** imports Apple, Google and Outlook calendars. https://www.tiimoapp.com/faq
- **Apple Reminders**: from iOS 18 "scheduled reminders now appear in the Calendar app alongside your events". https://support.apple.com/en-us/102484

**Fit for Brian: borderline.** The Week page is "not a calendar of appointments" by design, and real appointments are the one thing that eats open time without being a Block. Two honest options: (a) a read-only iCal URL drawn as hatched "busy" on the Week page — new import code, a new drawn thing, but no new user concept if it is simply *seen*; (b) nothing in the app, and let Claude (which can read the user's calendar through its own connectors) create one-off Blocks for appointments via `create_block`. (b) costs nothing and keeps the Week page honest about what a Block is. Extends: **Block**.

### 2.9 Notifications / reminders

- **Todoist**: automatic reminder for any task with a date *and time*; recurring reminders. https://www.todoist.com/help/todoist/features/introduction-to-recurring-dates-YUYVJJAV
- **Superlist**: "When you set a due time for a task, Superlist will now automatically schedule a reminder notification". https://www.superlist.com/updates/automatic-reminders
- **Things**: reminders are "a gentle nudge" at a set time; repeating to-dos can appear "days earlier" than their deadline. https://culturedcode.com/things/support/articles/2803579/ https://culturedcode.com/things/support/articles/2803564/
- **Apple Reminders**: time, location ("when I get home"), and "When Messaging" triggers. https://support.apple.com/en-us/102484
- **Microsoft To Do**: "Remind me" later today / tomorrow / next week / pick. https://support.microsoft.com/en-us/office/my-day-and-suggestions-fc09a1b9-0854-4906-b166-f480ee97a139

**Fit for Brian: yes, narrowly.** Brian has no notifications at all. Two triggers already exist in the data without any new field: a Placement with an hour (notify at start) and Due = today (a morning nudge). Web Push works in the installed PWA on both platforms; the server already knows every Device. Per-task custom reminder times, location and messaging triggers are more fields for little gain. Extends: **Placement**, **Task**, **Device**.

### 2.10 Energy / effort estimates

- **Morgen** filters tasks into Frames by "high, medium, or low energy" and by size XS–L. https://www.morgen.so/frames
- **Tiimo** logs mood to "identify energy and focus patterns". https://www.tiimoapp.com/

**Fit for Brian: no.** Priority already answers "how much does it matter"; energy adds a second axis that only pays off with an auto-scheduler. Duration (next) does most of the useful work.

### 2.11 Task duration estimates

- **Todoist**: `Today 21:00 for 2h`; drag the bottom edge in the calendar layout; max 24 h; Pro only. https://www.todoist.com/help/todoist/features/set-a-task-duration-L1kYkZv8d
- **Sunsama**: planned time via `~30m` at creation or `W`; sums into the day's workload. https://help.sunsama.com/docs/planned-and-actual-times
- **Morgen**: `[30m]`/`[1h]` tags; a task dropped on the calendar "will be sized for that amount of time"; default 30 min. https://www.morgen.so/guides/plan-your-day-using-the-ai-planner
- **Reclaim / Motion**: duration is the input everything else is computed from. https://help.reclaim.ai/en/articles/5108936-tasks-overview https://www.usemotion.com/help/project-management/task

**Fit for Brian: yes, as an optional `estimate` in minutes on the Task.** It gives a Placement its default length when placed "at…" (today the user drags or types an end), lets the unplaced tray show `45m` next to a title, and is the one field Claude needs to propose a realistic plan. The day-total that Sunsama builds on it is exactly what TB-2 forbids — keep the estimate per Task, never summed on screen. Extends: **Task**, **Placement**.

### 2.12 Deferral / "someday"

- **Things**: Someday is "for everything that's not clear yet"; Anytime is what is actionable now; Upcoming hides things until their start date. https://culturedcode.com/things/support/articles/4001304/
- **Akiflow**: "Snooze tasks that are not immediately actionable". https://akiflow.com/features
- **Routine**: Postpone instead of roll-over. https://feedback.routine.co/changelog/planner-and-new-console

**Fit for Brian: mostly already there.** "On hold" is Someday; Scheduled-in-the-future is Upcoming; Archive is the deliberate out-of-sight. What is missing is only the *gesture*: a one-tap "later" (tomorrow / next week / pick a day) on Home and List rows, which the phone report already proposes as swipe-left = schedule. No new concept.

### 2.13 Inbox / triage

- **Things** Inbox: "temporary staging ground for your unprocessed thoughts". https://culturedcode.com/things/support/articles/4001304/
- **Structured** Inbox: tasks "without a specific time or date", dragged onto the timeline later. https://help.structured.app/en/articles/338178
- **Superlist** advertises overnight agent-driven inbox triage ("label, prioritize, set due dates"). https://www.superlist.com/mcp

**Fit for Brian: no separate Inbox.** "Every Task belongs to exactly one Space" and Quick Add already files into the current or last-used Space (Q18). The triage that matters — undated Tasks with no Scheduled day piling up — is a List filter ("no date"), not a place. Claude can already do Superlist-style triage over `list_tasks` + `update_task`.

### 2.14 Keyboard shortcuts

- **Things**: all shortcuts work inside Quick Entry; Quick Find jumps to any list by typing. https://culturedcode.com/things/support/articles/2249437/ https://culturedcode.com/things/support/articles/2803584/
- **Sunsama**: `W` planned time, `E` actual, Space timer, `O` shutdown. https://help.sunsama.com/docs/planned-and-actual-times
- **Notion Calendar**: `T` today, `J`/`K` weeks, `N` next event, `?` shows all. https://www.notion.com/help/guides/getting-started-with-notion-calendar
- **Akiflow**: `P` plan, `F` pin a slot; command bar. https://product.akiflow.com/help/articles/3677363-time-blocking-101

**Fit for Brian: yes, cheap.** Brian's desktop shell has none beyond Enter/Escape in sheets. A dozen single-key bindings (`n` new Task, `t` today, `j`/`k` week, `1–4` tabs, `/` search, `?` help) and a Things-style "type to jump" are a day's work and touch only `Shell.tsx`. Extends: the shell.

### 2.15 Templates

- **Apple Reminders**: save a list as a template, share by link. https://apps.apple.com/app/reminders/id1108187841
- **Structured**: keep the original in the Inbox and duplicate it. https://help.structured.app/en/articles/338178

**Fit for Brian: no.** A template is a Task that is not a Task. With a checklist field and the MCP server, "make me the packing list" is a sentence to Claude.

### 2.16 Time tracking

- **Sunsama** actual vs planned; **Timo** per-todo timers; **TickTick** focus records; **Hours tracker – Timo** shifts and pay. (Sources above.)

**Fit for Brian: no.** Ruled out in the Week agreement, and every app that has it grows a statistics page around it.

### 2.17 Stats / streak views

- **Todoist Karma**: daily goal (default 5) and weekly goal (25), streaks, levels, Vacation Mode so "You won't break your streak". https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9
- **TickTick**: habit statistics by week/month/record; focus statistics by list and tag. https://help.ticktick.com/articles/7055781785312952320 https://blog.ticktick.com/2020/05/06/brand-new-focus-experience-ticktick/
- **Timo Focus**: streaks of intentional sessions. https://apps.apple.com/us/app/timo-intentional-screen-time/id6758259991

**Fit for Brian: Karma no; a Routine's history yes.** Points, levels and completed-task goals are gamification and would put a score on Home. But a Routine currently shows one number (Streak); a month grid of Check-ins and Missed days in `RoutineEditor` is the same data drawn, "seen not computed", and answers "how is this actually going". Extends: **Routine**.

### 2.18 AI / assistant-driven features

- **Structured MCP**: "read, manage, and edit your tasks"; view today/upcoming/inbox, create with time/duration/colour/alerts, update, complete, delete; recurring for Pro. https://help.structured.app/en/articles/9871042
- **Superlist MCP**: "the task layer built for AI agents" — daily briefings ("pull Today views, summarize due items, flag overdue tasks, and reorder based on calendar constraints"), overnight inbox triage, routine scaffolding. https://www.superlist.com/mcp
- **Todoist Assist**: suggest tasks for a goal, rewrite to be actionable, break down; processed on Doist's infrastructure. https://www.todoist.com/help/todoist/todoist-and-ai/introduction-to-todoist-assist-KgPP22q5O
- **Tiimo Co-Planner**, **Morgen AI Planner**, **Amie ai scheduling** (above).

**Fit for Brian: this is Brian's strongest position.** It already has what Structured and Superlist sell: an MCP server with the same domain functions as the UI (ADR 0002). Compared with those two, the gaps are (1) Placements cannot be written, so Claude can *say* a plan but not *make* it; (2) no `completed_since`/date-range read, so Claude cannot review a week; (3) no duration/checklist fields, so "break it down and size it" has nowhere to land; (4) no MCP *prompts* — MCP supports server-provided prompt templates, and "plan my day", "close my day", "review my week" as prompts would make the rituals in §2.1/§2.6 something Claude runs rather than something the app grows screens for.

## 3. Ranked shortlist

| # | Addition | One-line rationale | Extends |
|---|---|---|---|
| 1 | **`place_task` / `unplace_task` MCP tools** (+ `list_placements` for a date range) | Turns Claude from a narrator into the planner Morgen/Motion sell, while the user keeps the Week page as the only place things move by hand. Reverses one line of TB-23, as Block tools already did. | Placement, MCP |
| 2 | **`estimate` (minutes) on Task** | Sizes a Placement on drop, labels the unplaced tray, and is the one input a "plan my day" proposal needs. Never summed on screen (TB-2). | Task, Placement |
| 3 | **Natural-language Quick Add** (`tomorrow`, `fri`, `next week`, `!high`, `#space`, `@tag`) rendered as the existing chips | Todoist/Things/Reminders/Akiflow all converge on it; fewer taps, no new concept; the parser also serves `brian add`. | Task (QuickAdd, CLI) |
| 4 | **Repeat-after-done on Task** (`every N days/weeks/months/years` from the completion date) | Covers rent, passport, tax, servicing — obligations that are finished each time and are therefore Tasks, not Routines. One record, no template, no future instances. | Task, `create_task`/`update_task` |
| 5 | **Checklist inside a Task** (flat, not nested Tasks) | Things/Reminders/To Do all have it; it is where Claude's "break it down" lands; keeps Board/List/Home counts honest. | Task |
| 6 | **"Close the day" on Home** (evening: each unfinished Today/placed Task → done · tomorrow · unschedule) plus an MCP prompt for it and for "Plan today" | Sunsama/Akiflow's rituals without workload maths or day ratings; Brian already refuses roll-over, this gives the moment to decide. | Home, MCP |
| 7 | **Push notifications** for a Placement at its hour and a morning "due today" | Brian has none; both triggers exist in the data already; PWA push works on every Device the server knows. | Placement, Task, Device |
| 8 | **Keyboard shortcuts + type-to-jump** on desktop | Things/Notion Calendar/Sunsama; a day of work in `Shell.tsx`, no data change. | Shell |
| 9 | **Week look-back** (done per Space, Routines checked/scheduled, stale placements) and `completed_since` on `list_tasks` | Sunsama's weekly review minus objectives and reflections; the Week page already holds the record, this reads it; Claude can write the review. | Week/Home, MCP |
| 10 | **Routine history grid** (month of Check-ins / Missed in the editor) | TickTick habit review, drawn not scored; Streak alone hides how a Routine is going. | Routine |
| 11 | **One-tap "later"** on Home/List rows (tomorrow · next week · pick a day) | Things Someday / Akiflow snooze as a gesture on the existing Scheduled field; pairs with #6. | Task, Home |
| 12 | **Appointments as one-off Blocks via Claude** rather than an iCal import | Keeps "a Block is not an appointment" true in the app while still letting open time be honest; if that proves too manual, revisit a read-only iCal overlay. | Block, MCP |

Deliberately not recommended: Pomodoro/focus timers, time tracking, Karma-style goals, energy levels, templates, a separate Inbox, nested sub-Tasks, algorithmic auto-scheduling, mood logging. Each adds a concept or a ledger that the calm, single-user philosophy in `CONTEXT.md` and the Week agreement in `docs/time-blocks.md` already declined.
