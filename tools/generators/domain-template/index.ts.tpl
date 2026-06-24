/**
 * @domains/__name__ — __name__ 域库公共 barrel。
 *
 * 仅依赖 @core/* 与 @platform/*（禁止依赖其它 @domains / @integrations / apps）。
 */
export * from './__name__.module';
export * from './entities';
export * from './services';
// 视需要补充：./dto ./vo ./mapper ./assembler ./types ./constants
