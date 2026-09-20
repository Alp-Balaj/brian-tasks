---
status: accepted
---

# Standing blocks as versioned rules

A standing Block (Job, Gym, Sleep) is stored once as a rule that applies to a range of weeks: `from` is the Monday of the first week it applies to, `until` the Monday of the first week it no longer does, exclusive; `until` absent means it carries to every following week. A one-off Block is the same record with `until` set to the following week, so "Carry to next week" in the sheet is nothing more than whether `until` is set (D1, D2). Which Blocks a week shows is one predicate, `appliesTo(block, week)`; opening a new week writes nothing.

Editing a standing Block applies to this week and all future weeks while past weeks keep what they had (TB-5). That falls out of one operation: split the rule at week W. The past version keeps its id and ends at W; the future version starts at W under a fresh id and takes the edit. Placements dated W or later are re-pointed to the future version — they are few (this week, maybe next), where past ones can be many (D8). Turning carry-over off is the same split with the future version's `until` set to W+1. Routine links live on the Block (`routineIds`) and are versioned with it, so they carry; Task links are Placements keyed by date, so they do not (TB-9).

## Considered options

- **Materialised copies** — one Block row per week, stamped out when a week is first opened. Simple to read, but a standing Block becomes a row per week forever, opening a week is a write, and "edit this and all future weeks" is a bulk update that has to find every copy and know which ones the user has since changed by hand.
- **RRULE-style recurrence with exceptions** — the calendar-standard shape (a rule plus a set of overrides). Far more than the one rhythm the agreement allows (weekly, TB-4/TB-23), and "this week only" exceptions are exactly what TB-5 rules out; a one-week deviation is a one-off Block.
- **Versioned rules** (chosen) — one row per version, `from`/`until` week keys, a split on edit. One record shape for standing and one-off, one query, and the past stays honest by construction (TB-1).

## Consequences

- A split re-points Placements: every Placement in the Block dated from W on moves to the future version's id, with a fresh `updatedAt` so other Devices learn the new link. Placements before W are untouched.
- A lineage has no id of its own: after a split, the past and future versions are related only by history. "Delete everywhere" is therefore not offered in v1; the sheet offers "Remove from this week on" (the rule ends at W) and a true delete only for a version that starts in W.
- Two versions of the same lineage never overlap in time, because a split always produces `past.until === future.from`. The store keeps that invariant; nothing else relies on lineage.
- The sync model is unchanged (ADR 0001): a Block version and a Placement are ordinary rows under newest-wins, and a version deleted on one Device is a tombstone on the others. When Devices merge, a Placement whose Block version is gone keeps its hour or is dropped, and a Block forgets Routines that no longer exist.
- Past weeks are a record (TB-1). Every version is kept, so the table grows by one row per edit of a standing Block rather than one row per week; nothing is ever compacted.
