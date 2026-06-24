/**
 * @core/i18n — 基于 nestjs-i18n 的国际化
 *
 * 封装 I18nModule，提供 locale 解析器链、薄封装 I18nService 与内置文案（en / zh-CN）。
 */
export * from './i18n.constants';
export * from './locale.resolver';
export * from './i18n.service';
export * from './i18n.module';
