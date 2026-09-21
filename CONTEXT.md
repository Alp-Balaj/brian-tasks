# Brian Tasks

A single-person task manager. One user, one brain; the vocabulary exists to keep the app calm, not to coordinate a team.

## Language

### Tasks

**Task**:
A discrete piece of work that moves through a lifecycle (to do → in progress / on hold → done) and is finished exactly once.
_Avoid_: Todo, item, card

**Status**:
Where a Task is in its lifecycle: to do, in progress, on hold, done.
_Avoid_: State, column

**Priority**:
How much a Task matters relative to others: low, normal, high, urgent.

**Due**:
The hard deadline of a Task.
_Avoid_: Deadline

**Scheduled**:
The day you intend to work on a Task. Not a commitment to finish it. Placing a Task on a day sets this to that day (the earliest, if placed on several).
_Avoid_: Planned

**Overdue**:
A Task whose Due date has passed and which is not done. Home shows it right after Today.
_Avoid_: Late, missed (reserved for Routines)

**Tag**:
A free-form, cross-cutting label. A Task can carry any number; Tags never determine where a Task lives.
_Avoid_: Label, category

**Archived**:
A Task (or Routine) you have deliberately put out of sight. Archived things are hidden from every view unless explicitly asked for, regardless of Status.
_Avoid_: Hidden, deleted, the `archived` tag

**Pinned**:
A Task you have hand-picked to appear on Home.
_Avoid_: Starred, favourite, flagged

**Estimate**:
How long one sitting of a Task is expected to take, in minutes. Sizes a Placement when the Task is put at an hour. Never added up.
_Avoid_: Duration, time budget, effort

**Checklist**:
The flat list of steps inside a Task, each ticked or not. Steps are not Tasks; ticking them all does not finish the Task.
_Avoid_: Subtasks, sub-items, nested tasks

**Repeat**:
A rule on a Task that brings it back: every N days, weeks, months or years, counted from its Due date or from the day it was finished. Finishing a repeating Task finishes that Task; the next occurrence is a new Task.
_Avoid_: Recurring task, recurrence, RRULE (and never for Routines)

### Spaces

**Space**:
The one container a Task lives in (e.g. Personal, Work, University). Every Task belongs to exactly one Space; Spaces partition Tasks into categories.
_Avoid_: Board, workspace, project, area, list

**All spaces**:
The switcher choice that shows every Task from every Space at once. Not a Space itself.

**Board**:
The kanban view of Tasks (columns by Status). Only ever means the view.
_Avoid_: using Board to mean a Space

### Routines

**Routine**:
Something you do repeatedly on a schedule (e.g. "Read 20 pages", daily). Not a Task: it is never finished, only done-for-today or not, and it never appears on the Board, List or Calendar.
_Avoid_: Recurring task, habit, daily

**Schedule**:
The days on which a Routine is expected: every day, or a chosen set of weekdays.
_Avoid_: Frequency, recurrence, RRULE

**Check-in**:
The record that a Routine was done on a specific day. A Check-in is a fact about that day, not an edit to the Routine: once made anywhere it stays made everywhere until you explicitly uncheck it.
_Avoid_: Completion, tick, done (reserved for Task Status)

**Missed**:
A scheduled day that ended without a Check-in. A Missed day is history; it never carries over into the next day.
_Avoid_: Overdue (reserved for Tasks past their Due date)

**Streak**:
The number of consecutive scheduled days, ending today or yesterday, that have a Check-in. Unscheduled days neither extend nor break it.

**Today**:
The current calendar day in local time, rolling over at midnight.

### Time

**Block**:
A named, coloured span of one day on the Week page (Job 09–17). Not a Task, not an appointment.
_Avoid_: Event, slot, session

**Standing**:
A Block that carries to every following week until told otherwise.
_Avoid_: Recurring, template, repeating

**Open time**:
Any part of a day with no Block. Never computed, only seen.

**Placement**:
A Task put on a specific day, inside a Block and/or at an hour. A Task can have several.
_Avoid_: Event, time slot, booking

**Placed / Unplaced**:
A Task is placed on a day when it has a Placement there; unplaced = Scheduled for a day with no Placement on it.

**Stale**:
A Placement on a day that has passed whose Task is still not done. Shown in the Look-back, one tap to remove.
_Avoid_: Overdue, missed (both reserved)

**Look-back**:
The one line under a week's heading on the Week page — Tasks finished that week, Routines checked over scheduled, stale Placements — and the sheet behind it. Drawn, not scored.
_Avoid_: Review, report, stats, score

**Week**:
The page: seven day rows, 00–24, Blocks and Placements drawn to scale, plus each day's unplaced tray.
_Avoid_: Schedule, timetable, planner

### Home

**Home**:
The landing page. Today's strip of Blocks and Placements at the very top, then only the few Tasks that matter right now and Today's Routines, across all Spaces: what is due or Scheduled Today, then Overdue, then Routines, then Pinned, then in progress. A Task appears once, in the first of those it qualifies for.
_Avoid_: Dashboard, overview, today view

**Close the day**:
Home's last section from 18:00: every Task still open on Today, each settled as done, tomorrow, or Later. A state of the evening, not a record; an unclosed day is simply tomorrow's Overdue.
_Avoid_: Shutdown, daily review, roll-over

**Later**:
The one-tap way to move a Task off Today — tomorrow, next week, a chosen day, or unscheduled. It moves the date that put the Task on Today (Due if it was due, else Scheduled) and leaves Placements alone.
_Avoid_: Snooze, defer, postpone, someday

**Jump**:
The keyboard way to reach anything on a desktop (⌘K / Ctrl K): type part of a Task's title or a page's name, Enter opens it.
_Avoid_: Search, command palette, spotlight

### Archive

**Archive**:
The one place where Archived Tasks and Archived Routines can be seen, restored, or permanently deleted.
_Avoid_: Trash, bin, history

### Devices

**Device**:
One browser or installed app you use Brian from (the laptop, the phone). Your data is the same on every Device. A Device may be offline; it keeps working and catches up when it is back.
_Avoid_: Client, session, install

**Notification**:
What a Device that has opted in is told: a Task placed at an hour, when that hour comes, and one line at 08:00 about the day. Each Device decides for itself; nothing else is ever sent.
_Avoid_: Reminder, alert, push (fine in code)

**Catching up**:
What a Device does when it reconnects: it learns what changed elsewhere and tells the others what changed here. If the very same Task, Space or Routine was changed on two Devices while apart, the later change wins and the earlier one is gone. Check-ins are never lost this way.
_Avoid_: Sync (fine in code, not in the UI), merge, conflict
