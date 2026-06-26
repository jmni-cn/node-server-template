import { HttpStatus } from '@nestjs/common';

/**
 * 系统域业务错误码。
 *
 * 约定：枚举值与键名一致（字符串字面量），便于直接作为 BusinessException 的 code。
 */
export enum SystemErrorCode {
  /** 配置不存在 */
  SYS_CFG_NOT_FOUND = 'SYS_CFG_NOT_FOUND',
  /** 配置 key 已被占用 */
  SYS_CFG_KEY_TAKEN = 'SYS_CFG_KEY_TAKEN',
  /** 配置值与声明类型不匹配 */
  SYS_CFG_TYPE_MISMATCH = 'SYS_CFG_TYPE_MISMATCH',
  /** 配置只读，不允许后台编辑（isEditable=false / 机密项） */
  SYS_CFG_NOT_EDITABLE = 'SYS_CFG_NOT_EDITABLE',
  /** 字典不存在 */
  SYS_DICT_NOT_FOUND = 'SYS_DICT_NOT_FOUND',
  /** 字典 code 已被占用 */
  SYS_DICT_CODE_TAKEN = 'SYS_DICT_CODE_TAKEN',
  /** 字典项不存在 */
  SYS_DICT_ITEM_NOT_FOUND = 'SYS_DICT_ITEM_NOT_FOUND',
  /** 同一字典下字典项 value 已被占用 */
  SYS_DICT_ITEM_VALUE_TAKEN = 'SYS_DICT_ITEM_VALUE_TAKEN',
}

/**
 * 系统域错误码 → HTTP 状态码映射。
 * 由 SystemModule 在初始化时注册进 @core/common 的全局注册表。
 */
export const SystemErrorCodeHttpStatus: Record<string, number> = {
  [SystemErrorCode.SYS_CFG_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [SystemErrorCode.SYS_DICT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [SystemErrorCode.SYS_DICT_ITEM_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [SystemErrorCode.SYS_CFG_KEY_TAKEN]: HttpStatus.CONFLICT,
  [SystemErrorCode.SYS_DICT_CODE_TAKEN]: HttpStatus.CONFLICT,
  [SystemErrorCode.SYS_DICT_ITEM_VALUE_TAKEN]: HttpStatus.CONFLICT,
  [SystemErrorCode.SYS_CFG_TYPE_MISMATCH]: HttpStatus.BAD_REQUEST,
  [SystemErrorCode.SYS_CFG_NOT_EDITABLE]: HttpStatus.FORBIDDEN,
};
