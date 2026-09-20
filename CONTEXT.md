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
The day you intend to work on a Task. Not a commitment to finish it.
_Avoid_: Planned

**Overdue**:
A Task whose Due date has passed and which is not done. The first thing Home shows.
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

### Home

**Home**:
The landing page. Shows only Today's Routines and the few Tasks that matter right now, across all Spaces: Overdue first, then what is due or Scheduled Today, then Pinned, then in progress. A Task appears once, in the first of those it qualifies for.
_Avoid_: Dashboard, overview, today view

### Archive

**Archive**:
The one place where Archived Tasks and Archived Routines can be seen, restored, or permanently deleted.
_Avoid_: Trash, bin, history

### Devices

**Device**:
One browser or installed app you use Brian from (the laptop, the phone). Your data is the same on every Device. A Device may be offline; it keeps working and catches up when it is back.
_Avoid_: Client, session, install

**Catching up**:
What a Device does when it reconnects: it learns what changed elsewhere and tells the others what changed here. If the very same Task, Space or Routine was changed on two Devices while apart, the later change wins and the earlier one is gone. Check-ins are never lost this way.
_Avoid_: Sync (fine in code, not in the UI), merge, conflict
