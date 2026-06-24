import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { I18N_CONSTANTS } from './constants';

/**
 * 国际化配置命名空间
 */
export const i18nConfig = registerAs('i18n', () => ({
  defaultLanguage: I18N_CONSTANTS.DEFAULT_LANGUAGE,
  fallbackLanguage: I18N_CONSTANTS.FALLBACK_LANGUAGE,
}));

/**
 * 国际化配置接口
 */
export interface I18nConfigType {
  defaultLanguage: string;
  fallbackLanguage: string;
}

/**
 * 国际化配置验证 Schema
 */
export const i18nConfigSchema = {
  I18N_DEFAULT_LANGUAGE: Joi.string()
    .default(I18N_CONSTANTS.DEFAULT_LANGUAGE)
    .description('默认语言'),
  I18N_FALLBACK_LANGUAGE: Joi.string()
    .default(I18N_CONSTANTS.FALLBACK_LANGUAGE)
    .description('回退语言'),
};
