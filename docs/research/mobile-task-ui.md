# Phone UI patterns in leading personal task managers — research report

(Full report as returned by the research agent, 2026-09-20. Sources: vendor help/blog pages, Apple HIG, Material 3, MacStories/TidBITS/Sweet Setup.)

## Patterns that recur (defaults worth adopting)

1. Circle checkbox on the left, ~24–28pt, universal (Things, Todoist, TickTick, Reminders, To Do, Habitify). Completing is always a tap, never gesture-only. Priority/list colour is encoded in or beside the circle, not as a full-row tint.
2. Today is sectioned, with overdue isolated and collapsible at the top, always red-coded and with a one-tap fix (Todoist Reschedule, TickTick Plan Your Day). Things puts "This Evening" at the bottom; Reminders: Overdue / All Day / Morning / Afternoon / Tonight.
3. Habits live in their own compact section, not mixed with tasks (TickTick). Check-in is a distinct control: tap-icon (TickTick), press-and-hold ring with haptic (Streaks), swipe for skip/fail (Habitify); streak = small number next to the control.
4. One primary add affordance, bottom-anchored: FAB bottom-right (Things, Todoist, TickTick, Habitify) or bottom input bar (To Do, Reminders). Linear is the exception (top button). Quick-add = one text field + optional chips (date, priority, list).
5. Swipe is for scheduling/triage, tap is for completing. Every app keeps a tap/long-press path for the same actions.
6. Neutral base + one accent + per-list colour. No app tints the whole background. Accent on add button, active tab, selected date. Per-project colour = small dot/icon/breadcrumb. Linear explicitly de-tints neutrals.
7. Dark mode is a separate palette with lifted surfaces, not inverted grey (Things Dark + Black/OLED; Material #121212 base + tinted overlay per elevation; Apple base vs elevated).
8. Navigation: 3–5 bottom tabs (Todoist, TickTick, Linear, Habitify, customisable) or a list-of-lists root (Things, Reminders, To Do). Nobody puts kanban in the tab bar; boards are a layout toggle inside a project with swiped columns and a column-picker (TickTick tap-column-name grid).

## Notable divergences

- Things: no tab bar; Magic Plus FAB doubles as drag-to-insert. Hard to replicate in a PWA.
- Linear: Create at the top; dense identifier/status rows.
- Todoist's Overdue collapses by default — users found it confusing. Prefer collapsed-with-count.
- Streaks: 2×3 grid of big rings, press-and-hold. TickTick: habit rows with tappable icon + streak number (middle ground).
- MS To Do: persistent bottom input bar; My Day empties each morning, refilled from Suggestions.
- Kanban on phone: only Todoist and TickTick; swiped columns + drag between them; TickTick adds column jump-grid. Linear has no board on mobile.

## Platform numbers

| Guidance | Value | Source |
|---|---|---|
| Apple minimum hit region | 44×44 pt | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| Material 3 minimum touch target | 48×48 dp | https://m3.material.io/foundations/designing/structure |
| iOS tab bar count | 3–5 | https://developer.apple.com/design/human-interface-guidelines/tab-bars |
| M3 navigation bar count | 3–5 | https://m3.material.io/components/navigation-bar/guidelines |
| M3 FAB placement | lower-right, above the navigation bar | https://m3.material.io/components/floating-action-button/guidelines |
| Safe area | bottom controls align to safe-area bottom | https://developer.apple.com/design/human-interface-guidelines/layout |
| Apple dark mode | base vs elevated backgrounds | https://developer.apple.com/design/human-interface-guidelines/dark-mode |
| M3 tonal surfaces | surface-container-lowest/low/container/high/highest; tonal difference instead of shadows | https://m3.material.io/styles/color/roles |
| Material dark theme | base #121212, primary-tinted overlay per elevation, desaturated accents | https://m2.material.io/design/color/dark-theme.html |

## Per-app notes

- Things 3: Today = events → to-dos → This Evening. Left circle, tags tucked in corner, row expands in place. White + Light/Dark/Black themes. Magic Plus FAB. Swipe right = When, left = select. No tab bar; list-of-lists root. https://culturedcode.com/things/support/articles/4001304/ https://culturedcode.com/things/support/articles/2803582/
- Todoist: Today = collapsible Overdue (with Reschedule) → Today. Priority flags P1 red / P2 orange / P3 blue / P4 none. Red accent, many themes, auto dark. FAB bottom-right; Quick Add with NL dates + chips. User-assignable swipes; long-press context menu. Customisable bottom bar (Inbox, Today, Upcoming, Browse). Board layout on phone with swiped columns. https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs https://www.todoist.com/help/articles/customize-the-todoist-navigation-bar-L4qpkI0xj
- TickTick: Today = Plan Your Day → overdue + today → Habit section below. Four swipe slots. Habit: tap icon to check in, tap number to toggle streak/total. Customisable 4-tab bar. Kanban: swipe columns, tap column name for grid. https://blog.ticktick.com/2019/03/14/ticktick-5-0-habit/ https://blog.ticktick.com/2020/07/03/kanban-manage-projects-on-the-go/
- Apple Reminders: Smart List tile grid root; Today sections Overdue / All Day / Morning / Afternoon / Tonight; list-tinted circle; priority = ! !! !!!; overdue red; "+ New Reminder" bottom text button. https://support.apple.com/guide/iphone/use-smart-lists-iphe882772ed/ios
- Microsoft To Do: My Day resets nightly, Suggestions pane; circle left, star right; persistent bottom "Add a task" bar; swipe right = My Day. https://support.microsoft.com/en-us/office/my-day-and-suggestions-fc09a1b9-0854-4906-b166-f480ee97a139
- Linear Mobile: dense rows; theme from 3 variables (base, accent, contrast), de-tinted neutrals; Create at top; customisable bottom toolbar; no board on phone. https://linear.app/now/how-we-redesigned-the-linear-ui
- Streaks: grid of 6 big rings/page, press-and-hold with haptic; streak number under ring. https://thesweetsetup.com/apps/best-habit-tracking-app-ios/
- Habitify: Journal filtered by Morning/Afternoon/Evening; row with icon + check circle + fill progress; swipe = note/skip/fail; long-press multi-select. https://feedback.habitify.me/changelog

## Recommendations for this app (from the agent)

1. Home: isolated, collapsible Overdue block at top with count and one-tap reschedule; Routines compact block; then Today, In progress; Pinned as a marker rather than a section.
2. Tonal rows on a tinted page background, grouped into one rounded container per section (iOS grouped-inset), no borders; dark = ~#121212 base with lifted row surfaces.
3. Row anatomy: 24px circle checkbox in 44×44 hit area, title 2-line clamp, grey metadata line (red if overdue), Space as dot/chip, priority glyph only when non-default. Min row 44pt.
4. One accent colour; per-Space colours only in dots/chips; dark mode derived from base/accent/contrast.
5. FAB bottom-right 56px, 16px above tab bar inside safe area; sheet = auto-focused input + chips (date, Space, priority).
6. Gestures with tap fallbacks: swipe-right complete, swipe-left schedule, long-press menu.
7. Routines as a strip/grid of rings, tap or press-and-hold, streak number next to ring, done ones greyed.
8. Keep 4 tabs; Board as a layout toggle inside List; column-picker for Board on phone.
9. Tab bar 49–56px + safe area, 24px icons, 11–12px labels, ≥44×44 items.
10. "Plan today" pill at the top of Home to triage overdue.
