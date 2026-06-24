/**
 * @domains/access-control — 访问控制（RBAC）域。
 *
 * 提供角色/权限/菜单管理、用户授权，以及 ACCESS_CHECKER 端口实现。
 */

// Module
export * from './access-control.module';

// Services
export * from './services';

// Entities（含枚举）
export * from './entities';

// DTOs
export * from './dto';

// VOs
export * from './vo';

// Mappers
export * from './mapper';

// Assembler
export * from './assembler';

// Types
export * from './types';

// Constants
export * from './constants';

// 便捷再导出 ACCESS_CHECKER（主来源仍为 @platform/auth）。
export { ACCESS_CHECKER } from '@platform/auth';
