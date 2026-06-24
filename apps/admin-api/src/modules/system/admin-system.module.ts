import { Module } from '@nestjs/common';
import { SystemModule } from '@domains/system';
import { DictionariesController } from './dictionaries.controller';
import { SystemConfigsController } from './system-configs.controller';

/** 管理后台系统域模块：字典 + 系统配置。 */
@Module({
  imports: [SystemModule],
  controllers: [DictionariesController, SystemConfigsController],
})
export class AdminSystemModule {}
