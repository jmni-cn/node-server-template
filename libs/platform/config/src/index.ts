/**
 * @platform/config — 运行时配置基础设施。
 *
 * 支撑「业务/安全配置热更新（DB 覆盖）」：
 * - SystemConfig 实体（表 system_configs，归属本层）；
 * - ConfigDefinition 定义注册表（代码默认值 / 标志位）；
 * - RuntimeConfigService（DB → 默认 两层解析 + 来源追踪 + 多级缓存 + 写时失效，fail-safe）；
 * - ConfigRuntimeModule（非全局，消费方各自显式 import）。
 *
 * 解析优先级：DB 行（启用且有值）→ 代码默认值（def.defaultValue ?? 传入默认）。
 * 机密（clientSecret / JWT 密钥 / 盐）永不进 DB，仅走 env + 启动期 Joi 校验。
 *
 * 约束：本层为低层基础设施，**不得依赖 @domains/@integrations**（避免循环依赖）。
 */

// Entities
export * from './entities';

// Definition registry
export * from './definitions/config-definition.type';

// Service
export * from './runtime-config.service';

// Module
export * from './config-runtime.module';
