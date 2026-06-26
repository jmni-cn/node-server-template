import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { type ConfigType } from '@nestjs/config';
import { databaseConfig } from '@core/config';
import { AuditFieldsSubscriber } from './subscribers/audit-fields.subscriber';

/**
 * 数据库模块。
 * 使用 @core/config 的 databaseConfig 异步初始化 MySQL 连接。
 *
 * - synchronize: false（schema 变更走 migration）
 * - autoLoadEntities: true（自动加载各特性模块通过 forFeature 注册的实体）
 * - AuditFieldsSubscriber：作为 provider 注入，构造时自挂载到 DataSource，
 *   在写操作时从请求上下文回填行级操作人审计列。
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        type: 'mysql',
        connectorPackage: 'mysql2',
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        autoLoadEntities: true,
        synchronize: false,
        logging: config.logging,
        charset: config.charset,
        collation: config.collation,
        timezone: config.timezone,
        extra: {
          connectionLimit: config.extra.connectionLimit,
        },
      }),
    }),
  ],
  providers: [AuditFieldsSubscriber],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
