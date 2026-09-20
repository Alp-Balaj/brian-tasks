---
status: accepted
---

# Per-entity last-writer-wins sync over Postgres

The app is local-first (each Device keeps a full copy in `localStorage` and works offline) and single-user, hosted on Railway with a managed Postgres holding the one shared copy. Devices reconcile per entity: each Task, Space and Routine is compared by `updatedAt`, the newer row wins outright, and deletions are kept as tombstones so a Device that was offline learns about them. Check-ins are the exception: they are facts about a day, synced as their own rows and merged as a set union, so a Check-in made on any Device survives unless explicitly unchecked (which is itself a tombstone).

## Considered options

- **Whole-snapshot replace** — fits the existing `Repository.load/save` exactly, but one offline Device coming back would silently wipe every edit made elsewhere in the meantime.
- **Field-level / CRDT merge** (Replicache, PowerSync, Yjs, ...) — keeps both sides of a same-entity conflict, at the cost of a large dependency and a rewrite of the stores. Rejected because one person rarely edits the same entity on two Devices inside one offline window; losing one edit to one entity is an acceptable price for a few hundred lines we own.

## Consequences

- Every synced entity needs `updatedAt` (Spaces currently lack one) and a tombstone on delete; `remove` can no longer be a plain filter.
- Clocks matter: `updatedAt` is set by the Device, so a Device with a badly wrong clock can win conflicts it shouldn't. Accepted for a single user.
- Moving to a CRDT later is a change to the sync layer only; the row shape (id + updatedAt) is compatible with that path.
