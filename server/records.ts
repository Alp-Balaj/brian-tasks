// The server's typed view of the synced records, for the MCP tools. Reads come
// straight from the rows table; writes go through the same newest-wins rule as a
// Device's sync, so a Task made here is just a row every Device will pick up on
// its next catch-up.
import type { Task } from '../src/domain/task.ts'
import type { Space } from '../src/domain/space.ts'
import type { CheckIn, RoutineRecord } from '../src/domain/routine.ts'
import type { Block, Placement } from '../src/domain/block.ts'
import { readRows, writeRows, type Row } from './db.ts'

export interface Records {
  tasks(): Promise<Task[]>
  spaces(): Promise<Space[]>
  routines(): Promise<RoutineRecord[]>
  checkIns(): Promise<CheckIn[]>
  /** Every version of every Block (ADR 0003); filter with `blocksOn` / `blocksInWeek`. */
  blocks(): Promise<Block[]>
  placements(): Promise<Placement[]>
  /** Newest `updatedAt` wins, same as sync. A `deleted` row is a tombstone. */
  put(rows: Row[]): Promise<void>
}

const live = <T>(kind: string) => async (): Promise<T[]> => (await readRows(kind)).map((r) => r.data as T)

export const pgRecords: Records = {
  tasks: live<Task>('task'),
  spaces: live<Space>('space'),
  routines: live<RoutineRecord>('routine'),
  checkIns: live<CheckIn>('checkin'),
  blocks: live<Block>('block'),
  placements: live<Placement>('placement'),
  put: writeRows,
}
