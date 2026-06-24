/**
 * 系统域共享类型。
 */

/** 系统配置经类型化解析后的值类型。 */
export type TypedConfigValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | null;
