/**
 * SystemConfig 兼容 re-export。
 *
 * 实体已下沉到 @platform/config（运行时配置基础设施层）。
 * 为避免破坏 @domains/system 内部与外部对旧路径的引用，这里做一次兼容性
 * 转发。新代码请直接从 @platform/config 导入。
 *
 * 注意：实体类只能有唯一定义，本文件仅做转发，不重复声明实体。
 */
export {
  SystemConfig,
  SystemConfigType,
  SystemConfigSource,
} from '@platform/config';
