import { Global, Module } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { I18nModule as NestI18nModule } from 'nestjs-i18n';
import { i18nConfig } from '@core/config';
import { I18nService } from './i18n.service';
import { I18N_MESSAGES_PATH } from './i18n.constants';
import { localeResolvers } from './locale.resolver';

/**
 * 国际化模块（全局）。
 *
 * 封装 nestjs-i18n 的 I18nModule：
 * - fallbackLanguage 取自 @core/config 的 i18nConfig
 * - 文案 loader path 指向 @core/i18n 的 messages 目录
 * - 解析器链来自 locale.resolver（query / header / Accept-Language）
 *
 * 同时导出薄封装的 I18nService（@core/i18n）便于注入。
 */
@Global()
@Module({
  imports: [
    NestI18nModule.forRootAsync({
      inject: [i18nConfig.KEY],
      useFactory: (config: ConfigType<typeof i18nConfig>) => ({
        fallbackLanguage: config.fallbackLanguage,
        loaderOptions: {
          path: I18N_MESSAGES_PATH,
          watch: process.env.NODE_ENV !== 'production',
        },
      }),
      resolvers: localeResolvers as never,
    }),
  ],
  providers: [I18nService],
  exports: [I18nService, NestI18nModule],
})
export class I18nModule {}
