import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { RuntimeConfigService } from './runtime-config.service';

/**
 * ConfigRuntimeModule — 运行时配置读取/写入模块。
 *
 * 提供 RuntimeConfigService（业务/安全配置热更新核心，DB 覆盖 + env 兜底 + 代码默认）。
 *
 * 设计要点：
 * - **非 @Global**：需要运行期配置的 lib/app 各自显式 import 本模块；
 * - 依赖全局 CacheModule（@platform/cache，@Global）提供的 CacheService，故此处无需再 import；
 * - 通过 `TypeOrmModule.forFeature([SystemConfig])` 注册实体，配合 DatabaseModule 的
 *   autoLoadEntities 自动加载，无需在根模块手动登记实体。
 */
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService],
})
export class ConfigRuntimeModule {}
