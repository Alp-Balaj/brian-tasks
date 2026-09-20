// One generic table holds every synced record. The server never interprets
// `data`; it only compares `updated_at` (ISO 8601 strings, so text order is
// time order) and hands back what changed since a cursor. See src/sync/merge.ts
// for the client half and docs/adr/0001 for why.
import pg from 'pg'

export interface Row {
  kind: string
  id: string
  updatedAt: string
  deleted: boolean
  data: unknown
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS sync_seq;
    CREATE TABLE IF NOT EXISTS rows (
      kind       text    NOT NULL,
      id         text    NOT NULL,
      updated_at text    NOT NULL,
      deleted    boolean NOT NULL DEFAULT false,
      data       jsonb,
      seq        bigint  NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE INDEX IF NOT EXISTS rows_seq ON rows (seq);
  `)
}

/**
 * Apply the Device's rows (newer `updated_at` wins, ties are ignored) and return
 * everything that changed on the server since `since`, plus the new cursor.
 * Serialised with an advisory lock so two Devices syncing at once cannot miss
 * each other's rows through interleaved sequence numbers.
 */
export async function sync(since: number, incoming: Row[]): Promise<{ cursor: number; rows: Row[] }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(1)')
    for (const row of incoming) {
      await client.query(
        `INSERT INTO rows (kind, id, updated_at, deleted, data, seq)
         VALUES ($1, $2, $3, $4, $5, nextval('sync_seq'))
         ON CONFLICT (kind, id) DO UPDATE
           SET updated_at = EXCLUDED.updated_at,
               deleted    = EXCLUDED.deleted,
               data       = EXCLUDED.data,
               seq        = nextval('sync_seq')
           WHERE rows.updated_at < EXCLUDED.updated_at`,
        [row.kind, row.id, row.updatedAt, row.deleted, row.deleted ? null : JSON.stringify(row.data)],
      )
    }
    const changed = await client.query<{ kind: string; id: string; updated_at: string; deleted: boolean; data: unknown }>(
      'SELECT kind, id, updated_at, deleted, data FROM rows WHERE seq > $1 ORDER BY seq',
      [since],
    )
    const max = await client.query<{ cursor: string }>('SELECT COALESCE(MAX(seq), 0)::text AS cursor FROM rows')
    await client.query('COMMIT')
    return {
      cursor: Number(max.rows[0].cursor),
      rows: changed.rows.map((r) => ({ kind: r.kind, id: r.id, updatedAt: r.updated_at, deleted: r.deleted, data: r.data })),
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
