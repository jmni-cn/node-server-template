import { Injectable } from '@nestjs/common';
import { I18nService as NestI18nService } from 'nestjs-i18n';

/**
 * 薄封装的 i18n 服务。
 *
 * 在 nestjs-i18n 的 I18nService 之上提供更简洁的翻译入口，
 * 并集中处理错误码翻译约定（error.<CODE>）。
 */
@Injectable()
export class I18nService {
  constructor(private readonly i18n: NestI18nService) {}

  /**
   * 翻译指定 key。
   * @param key 文案 key（如 'common.success' 或 'error.RES_NOT_FOUND'）
   * @param options lang / args 等选项
   */
  translate(
    key: string,
    options?: { lang?: string; args?: Record<string, unknown> },
  ): string {
    return this.i18n.translate(key, options);
  }

  /**
   * 翻译错误码（约定 i18n key 为 error.<CODE>），未命中时回退原始 code。
   */
  translateError(code: string, lang?: string): string {
    try {
      const result = this.i18n.translate(`error.${code}`, {
        lang,
      });
      return result || code;
    } catch {
      return code;
    }
  }

  /** 暴露底层 nestjs-i18n 服务（高级场景使用） */
  get raw(): NestI18nService {
    return this.i18n;
  }
}
