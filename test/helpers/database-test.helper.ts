/**
 * Database test helper — truncate + seed utilities for e2e/integration tests.
 *
 * Operates on the DataSource from test-db.setup.ts. Truncation disables FK
 * checks so tables can be cleared in any order, then re-enables them.
 */
import type { DataSource } from 'typeorm';
import { getTestDataSource } from '../setup/test-db.setup';

/** Truncate every table except the migrations bookkeeping table. */
export async function truncateAll(
  ds: DataSource = getTestDataSource(),
): Promise<void> {
  const tables = ds.entityMetadatas
    .map((m) => m.tableName)
    .filter((name) => name !== 'migrations');

  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await ds.query(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await ds.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** Insert a batch of plain rows into a table via the query runner. */
export async function seedRows<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  ds: DataSource = getTestDataSource(),
): Promise<void> {
  if (rows.length === 0) return;
  const repo = ds.getRepository(table);
  await repo.insert(rows);
}

/** Run an arbitrary callback inside a transaction that is always rolled back. */
export async function withRollback(
  fn: (ds: DataSource) => Promise<void>,
  ds: DataSource = getTestDataSource(),
): Promise<void> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await fn(ds);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}
