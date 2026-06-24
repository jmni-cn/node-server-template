import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { registerErrorCodeHttpStatus } from '@core/common';
import { CacheModule } from '@platform/cache';
import { Dictionary } from './entities/dictionary.entity';
import { DictionaryItem } from './entities/dictionary-item.entity';
import { SystemConfig } from './entities/system-config.entity';
import { DictionaryService } from './services/dictionary.service';
import { SystemConfigService } from './services/system-config.service';
import { DictionaryAssembler } from './assembler/dictionary.assembler';
import { SystemErrorCodeHttpStatus } from './constants/system-error-codes';

// 注册系统域错误码 → HTTP 状态码映射（模块加载即生效）。
registerErrorCodeHttpStatus(SystemErrorCodeHttpStatus);

/**
 * 系统域模块。
 *
 * 提供字典与系统配置能力，依赖 TypeORM 特性仓储与全局 CacheModule。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Dictionary, DictionaryItem, SystemConfig]),
    CacheModule,
  ],
  providers: [DictionaryService, SystemConfigService, DictionaryAssembler],
  exports: [DictionaryService, SystemConfigService, DictionaryAssembler],
})
export class SystemModule {}
