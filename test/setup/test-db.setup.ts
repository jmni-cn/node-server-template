/**
 * Test DataSource helper.
 *
 * Spins up a TypeORM DataSource pointed at the test database, runs the
 * migrations (NEVER `synchronize` — schema is owned by /database/migrations,
 * see MIGRATION-SPEC.md), and exposes lifecycle helpers for e2e/integration
 * suites. Connection values come from the env defaults in jest.setup.ts (or
 * the CI / docker-compose.test.yml service containers).
 */
import { DataSource, type DataSourceOptions } from 'typeorm';
import { join } from 'path';

let dataSource: DataSource | undefined;

/** Build the test DataSource options (mysql; synchronize: false always). */
export function buildTestDataSourceOptions(): DataSourceOptions {
  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_DATABASE ?? 'app_template_test',
    synchronize: false,
    dropSchema: false,
    logging: false,
    entities: [
      join(process.cwd(), 'libs', '**', '*.entity.ts'),
      join(process.cwd(), 'apps', '**', '*.entity.ts'),
    ],
    migrations: [join(process.cwd(), 'database', 'migrations', '*.ts')],
    migrationsTableName: 'migrations',
  };
}

/** Initialize (once) and run pending migrations against the test database. */
export async function initTestDataSource(): Promise<DataSource> {
  if (dataSource?.isInitialized) {
    return dataSource;
  }
  dataSource = new DataSource(buildTestDataSourceOptions());
  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}

/** Get the initialized DataSource (throws if not yet initialized). */
export function getTestDataSource(): DataSource {
  if (!dataSource?.isInitialized) {
    throw new Error(
      'Test DataSource not initialized — call initTestDataSource() first.',
    );
  }
  return dataSource;
}

/** Close the DataSource (call in afterAll). */
export async function closeTestDataSource(): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
  dataSource = undefined;
}
