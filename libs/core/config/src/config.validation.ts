import * as Joi from 'joi';
import { allConfigSchemas } from './namespaces';

/**
 * 环境变量验证 Schema。
 * 由各命名空间的 schema 片段（allConfigSchemas）合并生成。
 */
export const configValidationSchema = Joi.object(allConfigSchemas);

/**
 * 配置验证选项。
 */
export const configValidationOptions = {
  // 允许未知的环境变量
  allowUnknown: true,
  // 遇到第一个错误时不停止，收集所有错误
  abortEarly: false,
};
