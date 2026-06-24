import { Module } from '@nestjs/common';
import { __Name__Controller } from './__name__.controller';

/**
 * __Name__ 模块。
 *
 * 在此导入所需的 domain/platform 模块（如 @domains/xxx 的 XxxModule），
 * 由其提供 service。本模块只装配 controller，不直接注册 repository。
 */
@Module({
  imports: [],
  controllers: [__Name__Controller],
  providers: [],
})
export class __Name__Module {}
