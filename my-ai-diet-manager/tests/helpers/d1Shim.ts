/**
 * A minimal D1-compatible shim backed by Node's built-in node:sqlite, used to run
 * the worker's real handlers against the real database/schema.sql in tests.
 * Loaded through a variable specifier so the project still type-checks on Node
 * versions whose bundled type definitions don't include node:sqlite yet.
 */
const SQLITE_SPECIFIER = "node:sqlite";

interface StatementHandle {
  bind: (...params: unknown[]) => StatementHandle;
  run: () => Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }>;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[]; success: boolean; meta: Record<string, never> }>;
}

export interface ShimDatabase {
  prepare: (sql: string) => StatementHandle;
  batch: (statements: StatementHandle[]) => Promise<Array<{ success: boolean; meta: { changes: number; last_row_id: number } }>>;
}

export async function createD1FromSchema(schemaSql: string): Promise<ShimDatabase | null> {
  let sqliteModule: { DatabaseSync: new (location: string) => any };
  try {
    sqliteModule = await import(/* @vite-ignore */ SQLITE_SPECIFIER);
  } catch {
    return null;
  }

  const { DatabaseSync } = sqliteModule;
  const raw = new DatabaseSync(":memory:");
  raw.exec(schemaSql);

  function makeStatement(sql: string, params: unknown[] = []): StatementHandle {
    return {
      bind: (...p: unknown[]) => makeStatement(sql, p),
      run: async () => {
        const stmt = raw.prepare(sql);
        const info = stmt.run(...params);
        return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
      },
      first: async <T>() => {
        const stmt = raw.prepare(sql);
        const row = stmt.get(...params);
        return (row ?? null) as T | null;
      },
      all: async <T>() => {
        const stmt = raw.prepare(sql);
        const rows = stmt.all(...params) as T[];
        return { results: rows, success: true, meta: {} };
      }
    };
  }

  return {
    prepare: (sql: string) => makeStatement(sql),
    batch: async (statements: StatementHandle[]) => Promise.all(statements.map((s) => s.run()))
  };
}
