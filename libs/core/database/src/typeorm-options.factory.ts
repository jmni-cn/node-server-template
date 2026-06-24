import type { DataSourceOptions } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import type { databaseConfig } from '@core/config';

/** 从 databaseConfig 命名空间解析出的 MySQL 连接形状 */
export type DatabaseConfigShape = ConfigType<typeof databaseConfig>;

/**
 * 由进程环境变量构造数据库连接形状。
 * 供 TypeORM CLI 的 data-source.ts 使用（脱离 Nest DI 容器）。
 */
export function databaseConfigFromEnv(): DatabaseConfigShape {
  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'app',
    logging: process.env.DB_LOGGING === 'true',
    charset: process.env.DB_CHARSET ?? 'utf8mb4',
    collation: process.env.DB_COLLATION ?? 'utf8mb4_0900_ai_ci',
    timezone: process.env.DB_TIMEZONE ?? '+00:00',
    extra: {
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT ?? '20', 10),
    },
    // databaseConfig 命名空间通过常量推断出字面量类型（如 logging: false），
    // 运行时这里是普通 boolean/string，断言回配置形状即可。
  } as DatabaseConfigShape;
}

/**
 * 共享的 TypeORM 连接选项工厂。
 *
 * 被 DatabaseModule（Nest DI，autoLoadEntities）与 data-source.ts（CLI，glob entities）共用。
 * synchronize 恒为 false —— 所有 schema 变更通过 migration 管理。
 *
 * @param config 数据库连接配置
 * @param opts.entities  显式实体来源；CLI 场景传入 glob，Nest 场景留空配合 autoLoadEntities
 * @param opts.migrations 迁移文件 glob
 */
export function createTypeOrmOptions(
  config: DatabaseConfigShape,
  opts?: {
    entities?: DataSourceOptions['entities'];
    migrations?: DataSourceOptions['migrations'];
  },
): DataSourceOptions {
  return {
    type: 'mysql',
    // 强制使用 mysql2 驱动
    connectorPackage: 'mysql2',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    logging: config.logging,
    charset: config.charset,
    timezone: config.timezone,
    synchronize: false,
    entities: opts?.entities ?? [],
    migrations: opts?.migrations ?? [],
    migrationsTableName: 'typeorm_migrations',
    extra: {
      connectionLimit: config.extra.connectionLimit,
    },
  };
}
