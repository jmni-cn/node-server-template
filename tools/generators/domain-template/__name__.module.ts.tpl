import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { __Name__ } from './entities';
import { __Name__Service } from './services';

/**
 * @domains/__name__ 模块。
 *
 * 注册实体 repository 并导出 service，供 apps 与其它允许的层注入。
 * 仅依赖 @core/* 与 @platform/*。
 */
@Module({
  imports: [TypeOrmModule.forFeature([__Name__])],
  providers: [__Name__Service],
  exports: [__Name__Service],
})
export class __Name__Module {}
