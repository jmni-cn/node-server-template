import {
  AcceptLanguageResolver,
  HeaderResolver,
  QueryResolver,
  type I18nResolver,
} from 'nestjs-i18n';

/**
 * 默认语言解析器链。
 *
 * 解析优先级（从高到低）：
 * 1. `?lang=` query 参数
 * 2. `X-Lang` / `X-Custom-Lang` 自定义请求头
 * 3. `Accept-Language` 请求头（浏览器自动发送）
 *
 * 供 I18nModule.resolvers 直接展开使用。
 */
type ResolverEntry =
  | I18nResolver
  | { use: unknown; options: unknown }
  | (new (...args: any[]) => I18nResolver);

export const localeResolvers: ResolverEntry[] = [
  { use: QueryResolver, options: ['lang'] },
  new HeaderResolver(['x-lang', 'x-custom-lang']),
  AcceptLanguageResolver,
];
