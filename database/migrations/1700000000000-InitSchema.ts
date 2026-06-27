import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitSchema — 初始化模板基础表结构。
 *
 * 覆盖所有平台/域实体对应的表：
 * identity:        admin_users, end_users, user_profiles, user_credentials, user_sessions,
 *                  external_identities, user_security_events
 *                  （共享卫星表通过 subject_type 区分 admin/user 主体）
 * access-control:  roles, permissions, menus, user_roles, role_permissions, role_menus
 * system:          dictionaries, dictionary_items, system_configs
 * audit:           operation_logs
 * task:            tasks, task_logs
 *
 * 约定：
 * - bigint PK auto_increment（task_logs 因继承 SystemBaseEntity 同样使用 bigint）
 * - uid varchar(32) 唯一索引
 * - 时间戳使用 datetime(6)（UTC）
 * - 软删除列 deleted_at（继承 BaseEntity / SystemBaseEntity 的实体）
 * - createdBy / updatedBy(+username) 仅存在于 BaseEntity 派生表
 * - JSON 列使用 MySQL 原生 json 类型
 * - 引擎 InnoDB，字符集 utf8mb4
 */
export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== identity: admin_users ====================
    await queryRunner.query(`
      CREATE TABLE \`admin_users\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 ausr_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`username\` varchar(50) NOT NULL COMMENT '管理员用户名（登录账号）',
        \`email\` varchar(255) NULL COMMENT '邮箱',
        \`nickname\` varchar(50) NULL COMMENT '展示昵称（用户可改）',
        \`status\` enum('active','disabled','locked','banned') NOT NULL DEFAULT 'active' COMMENT '账户状态: active/disabled/locked/banned',
        \`password_version\` int NOT NULL DEFAULT 0 COMMENT 'pv：改密递增使旧 token 失效',
        \`last_login_at\` datetime(6) NULL COMMENT '最后登录时间 (UTC)',
        \`last_login_ip\` varchar(45) NULL COMMENT '最后登录 IP',
        \`failed_login_count\` int NOT NULL DEFAULT 0 COMMENT '连续登录失败次数（成功登录后清零）',
        \`locked_until\` datetime(6) NULL COMMENT '账户锁定截止时间 (UTC)；为空或已过期表示未锁定',
        \`last_failed_login_at\` datetime(6) NULL COMMENT '最后一次登录失败时间 (UTC)',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_admin_users_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_admin_users_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台管理员主体表'
    `);

    // ==================== identity: end_users ====================
    await queryRunner.query(`
      CREATE TABLE \`end_users\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 eusr_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`username\` varchar(50) NULL COMMENT '用户名',
        \`email\` varchar(255) NULL COMMENT '邮箱',
        \`phone\` varchar(20) NULL COMMENT '手机号',
        \`nickname\` varchar(50) NULL COMMENT '展示昵称（用户可改）',
        \`status\` enum('active','disabled','locked','banned') NOT NULL DEFAULT 'active' COMMENT '用户状态: active/disabled/locked/banned',
        \`password_version\` int NOT NULL DEFAULT 0 COMMENT 'pv：改密递增使旧 token 失效',
        \`last_login_at\` datetime(6) NULL COMMENT '最后登录时间 (UTC)',
        \`last_login_ip\` varchar(45) NULL COMMENT '最后登录 IP',
        \`failed_login_count\` int NOT NULL DEFAULT 0 COMMENT '连续登录失败次数（成功登录后清零）',
        \`locked_until\` datetime(6) NULL COMMENT '账户锁定截止时间 (UTC)；为空或已过期表示未锁定',
        \`last_failed_login_at\` datetime(6) NULL COMMENT '最后一次登录失败时间 (UTC)',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_end_users_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_end_users_username\` (\`username\`),
        UNIQUE INDEX \`UQ_end_users_email\` (\`email\`),
        UNIQUE INDEX \`UQ_end_users_phone\` (\`phone\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='终端用户主体表'
    `);

    // ==================== identity: user_profiles ====================
    await queryRunner.query(`
      CREATE TABLE \`user_profiles\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 uprf_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`user_id\` varchar(32) NOT NULL COMMENT '关联 EndUser UID',
        \`nickname\` varchar(50) NULL COMMENT '昵称',
        \`avatar\` varchar(255) NULL COMMENT '头像 URL',
        \`gender\` enum('unknown','male','female') NOT NULL DEFAULT 'unknown' COMMENT '性别: unknown/male/female',
        \`bio\` varchar(500) NULL COMMENT '个人简介',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_user_profiles_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_user_profiles_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='终端用户资料表（END-ONLY）'
    `);

    // ==================== identity: user_credentials ====================
    await queryRunner.query(`
      CREATE TABLE \`user_credentials\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 ucrd_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`subject_type\` varchar(16) NOT NULL COMMENT '主体类型: admin/user',
        \`user_id\` varchar(32) NOT NULL COMMENT '关联主体 UID（AdminUser/EndUser）',
        \`password_hash\` varchar(255) NOT NULL COMMENT '密码哈希',
        \`password_updated_at\` datetime(6) NULL COMMENT '密码最后更新时间 (UTC)',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_user_credentials_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_user_credentials_subject_type_user_id\` (\`subject_type\`, \`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密码凭证表（admin/user 共享，subject_type 判别）'
    `);

    // ==================== identity: user_sessions ====================
    await queryRunner.query(`
      CREATE TABLE \`user_sessions\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 ses_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`subject_type\` varchar(16) NOT NULL COMMENT '主体类型: admin/user',
        \`user_id\` varchar(32) NOT NULL COMMENT '关联主体 UID（AdminUser/EndUser）',
        \`refresh_token_id\` varchar(64) NOT NULL COMMENT '刷新令牌标识 (JWT ID)',
        \`token_family_id\` varchar(36) NULL COMMENT '令牌家族 ID（同一登录链路的轮换会话共享）',
        \`token_hash\` varchar(100) NOT NULL DEFAULT '' COMMENT 'refresh token 明文的 SHA256（仅存哈希）',
        \`device\` varchar(100) NULL COMMENT '设备标识',
        \`device_id\` varchar(64) NULL COMMENT '设备唯一标识',
        \`device_name\` varchar(64) NULL COMMENT '设备名称',
        \`platform\` varchar(16) NOT NULL DEFAULT 'web' COMMENT '客户端平台: web/ios/android/...',
        \`app_version\` varchar(32) NULL COMMENT '客户端版本',
        \`ip\` varchar(50) NULL COMMENT '登录 IP',
        \`user_agent\` varchar(500) NULL COMMENT '用户代理原始字符串',
        \`geo\` json NULL COMMENT '地理位置信息',
        \`meta\` json NULL COMMENT '附加元数据',
        \`refresh_count\` int NOT NULL DEFAULT 0 COMMENT '令牌家族内已轮换次数',
        \`last_seen_at\` datetime(6) NULL COMMENT '最后活跃时间 (UTC)',
        \`expires_at\` datetime(6) NOT NULL COMMENT '过期时间 (UTC)',
        \`revoked_at\` datetime(6) NULL COMMENT '吊销时间 (UTC)',
        \`revoked_reason\` varchar(128) NULL COMMENT '吊销原因: rotated/reuse_detected/user_logout/password_changed ...',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_user_sessions_uid\` (\`uid\`),
        INDEX \`IDX_user_sessions_user_id\` (\`user_id\`),
        INDEX \`IDX_user_sessions_jti\` (\`refresh_token_id\`),
        INDEX \`IDX_user_sessions_token_family_id\` (\`token_family_id\`),
        INDEX \`IDX_user_sessions_subject_type_token_family_id\` (\`subject_type\`, \`token_family_id\`),
        UNIQUE INDEX \`UQ_user_sessions_subject_type_user_id_jti\` (\`subject_type\`, \`user_id\`, \`refresh_token_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表（admin/user 共享，subject_type 判别）'
    `);

    // ==================== identity: external_identities ====================
    await queryRunner.query(`
      CREATE TABLE \`external_identities\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 eid_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`subject_type\` varchar(16) NOT NULL COMMENT '主体类型: admin/user',
        \`user_id\` varchar(32) NOT NULL COMMENT '关联主体 UID（AdminUser/EndUser）',
        \`provider\` varchar(50) NOT NULL COMMENT '身份提供方标识，如 wechat/github',
        \`provider_user_id\` varchar(255) NOT NULL COMMENT '提供方侧用户唯一标识',
        \`union_id\` varchar(255) NULL COMMENT '提供方 UnionId（跨应用统一标识）',
        \`provider_nickname\` varchar(64) NULL COMMENT 'SSO provider 昵称快照（按 provider 绑定维度）',
        \`raw\` json NULL COMMENT '提供方返回的原始信息',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_external_identities_uid\` (\`uid\`),
        INDEX \`IDX_external_identities_subject_type_user_id\` (\`subject_type\`, \`user_id\`),
        INDEX \`IDX_external_identities_provider\` (\`provider\`),
        UNIQUE INDEX \`UQ_external_identities_subject_type_provider_provider_user_id\` (\`subject_type\`, \`provider\`, \`provider_user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='第三方身份表（admin/user 共享，subject_type 判别）'
    `);

    // ==================== identity: user_security_events ====================
    await queryRunner.query(`
      CREATE TABLE \`user_security_events\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 sev_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`subject_type\` varchar(16) NULL COMMENT '主体类型: admin/user（匿名事件可为空）',
        \`user_id\` varchar(32) NULL COMMENT '关联主体 UID（匿名事件可为空）',
        \`device_id\` varchar(64) NULL COMMENT '设备标识',
        \`session_uid\` varchar(32) NULL COMMENT '关联会话 UID',
        \`event_type\` varchar(64) NOT NULL COMMENT '事件类型',
        \`risk_level\` varchar(16) NOT NULL DEFAULT 'low' COMMENT '风险等级: low/medium/high/critical',
        \`ip_masked\` varchar(45) NULL COMMENT '脱敏后的 IP',
        \`user_agent_hash\` varchar(64) NULL COMMENT 'User-Agent 哈希',
        \`metadata\` json NULL COMMENT '附加元数据',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_user_security_events_uid\` (\`uid\`),
        INDEX \`IDX_user_security_events_subject_type_user_id_event_type\` (\`subject_type\`, \`user_id\`, \`event_type\`),
        INDEX \`IDX_user_security_events_subject_type_user_id_created_at\` (\`subject_type\`, \`user_id\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户安全事件表（admin/user 共享，subject_type 判别）'
    `);

    // ==================== access-control: roles ====================
    await queryRunner.query(`
      CREATE TABLE \`roles\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 role_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`code\` varchar(64) NOT NULL COMMENT '角色编码（唯一），如 admin/editor',
        \`name\` varchar(100) NOT NULL COMMENT '角色名称',
        \`description\` varchar(255) NULL COMMENT '角色描述',
        \`is_system\` tinyint NOT NULL DEFAULT 0 COMMENT '是否系统内置角色（内置角色禁止修改/删除）',
        \`enabled\` tinyint NOT NULL DEFAULT 1 COMMENT '是否启用（禁用后该角色授予的权限/菜单在聚合时被忽略）',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_roles_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_roles_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表'
    `);

    // ==================== access-control: permissions ====================
    await queryRunner.query(`
      CREATE TABLE \`permissions\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 perm_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`code\` varchar(128) NOT NULL COMMENT '权限编码（唯一），如 rbac:user:read',
        \`name\` varchar(100) NOT NULL COMMENT '权限名称',
        \`perm_group\` varchar(64) NOT NULL DEFAULT 'default' COMMENT '权限分组',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_permissions_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_permissions_code\` (\`code\`),
        INDEX \`IDX_permissions_group\` (\`perm_group\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表'
    `);

    // ==================== access-control: menus ====================
    await queryRunner.query(`
      CREATE TABLE \`menus\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 menu_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`parent_id\` varchar(32) NULL COMMENT '父菜单 UID（引用 Menu.uid），顶级节点为 null',
        \`name\` varchar(100) NOT NULL COMMENT '菜单名称',
        \`path\` varchar(255) NULL COMMENT '路由路径',
        \`icon\` varchar(100) NULL COMMENT '图标标识',
        \`sort\` int NOT NULL DEFAULT 0 COMMENT '排序值（越小越靠前）',
        \`type\` enum('directory','menu','button') NOT NULL DEFAULT 'menu' COMMENT '菜单类型：directory/menu/button',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_menus_uid\` (\`uid\`),
        INDEX \`IDX_menus_parent_id\` (\`parent_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单表'
    `);

    // ==================== access-control: user_roles ====================
    await queryRunner.query(`
      CREATE TABLE \`user_roles\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 urol_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`user_id\` varchar(32) NOT NULL COMMENT 'AdminUser uid（角色仅授予后台管理员）',
        \`role_id\` varchar(32) NOT NULL COMMENT '角色 UID',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_user_roles_uid\` (\`uid\`),
        INDEX \`IDX_user_roles_user_id\` (\`user_id\`),
        INDEX \`IDX_user_roles_role_id\` (\`role_id\`),
        UNIQUE INDEX \`UQ_user_roles_user_id_role_id\` (\`user_id\`, \`role_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色关联表'
    `);

    // ==================== access-control: role_permissions ====================
    await queryRunner.query(`
      CREATE TABLE \`role_permissions\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 rper_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`role_id\` varchar(32) NOT NULL COMMENT '角色 UID',
        \`permission_id\` varchar(32) NOT NULL COMMENT '权限 UID',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_role_permissions_uid\` (\`uid\`),
        INDEX \`IDX_role_permissions_role_id\` (\`role_id\`),
        INDEX \`IDX_role_permissions_permission_id\` (\`permission_id\`),
        UNIQUE INDEX \`UQ_role_permissions_role_id_permission_id\` (\`role_id\`, \`permission_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色-权限关联表'
    `);

    // ==================== access-control: role_menus ====================
    await queryRunner.query(`
      CREATE TABLE \`role_menus\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 rmnu_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`role_id\` varchar(32) NOT NULL COMMENT '角色 UID',
        \`menu_id\` varchar(32) NOT NULL COMMENT '菜单 UID',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_role_menus_uid\` (\`uid\`),
        INDEX \`IDX_role_menus_role_id\` (\`role_id\`),
        INDEX \`IDX_role_menus_menu_id\` (\`menu_id\`),
        UNIQUE INDEX \`UQ_role_menus_role_id_menu_id\` (\`role_id\`, \`menu_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色-菜单关联表'
    `);

    // ==================== system: dictionaries ====================
    await queryRunner.query(`
      CREATE TABLE \`dictionaries\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 dict_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`code\` varchar(64) NOT NULL COMMENT '字典编码（全局唯一）',
        \`name\` varchar(100) NOT NULL COMMENT '字典名称',
        \`description\` varchar(255) NULL COMMENT '字典描述',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_dictionaries_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_dictionaries_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典表'
    `);

    // ==================== system: dictionary_items ====================
    await queryRunner.query(`
      CREATE TABLE \`dictionary_items\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 ditm_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`dict_id\` varchar(32) NOT NULL COMMENT '所属字典UID（引用 Dictionary.uid）',
        \`label\` varchar(100) NOT NULL COMMENT '字典项标签（展示文本）',
        \`value\` varchar(255) NOT NULL COMMENT '字典项值',
        \`sort\` int NOT NULL DEFAULT 0 COMMENT '排序（升序）',
        \`status\` enum('enabled','disabled') NOT NULL DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_dictionary_items_uid\` (\`uid\`),
        INDEX \`IDX_dictionary_items_dict_id\` (\`dict_id\`),
        UNIQUE INDEX \`uq_dictionary_items_dict_value\` (\`dict_id\`, \`value\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典项表'
    `);

    // ==================== system: system_configs ====================
    await queryRunner.query(`
      CREATE TABLE \`system_configs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 cfg_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`config_key\` varchar(128) NOT NULL COMMENT '配置键（全局唯一）',
        \`config_value\` text NULL COMMENT '配置值（文本存储，按 type 解析）',
        \`type\` enum('string','number','boolean','json') NOT NULL DEFAULT 'string' COMMENT '值类型: string/number/boolean/json',
        \`config_group\` varchar(64) NOT NULL DEFAULT 'default' COMMENT '配置分组',
        \`description\` varchar(255) NULL COMMENT '配置描述',
        \`label\` varchar(100) NULL COMMENT '展示标签（后台列表/表单友好名称）',
        \`enabled\` tinyint NOT NULL DEFAULT 1 COMMENT '是否启用（禁用后运行期读取回退到 env/默认值）',
        \`is_secret\` tinyint NOT NULL DEFAULT 0 COMMENT '是否机密（机密值不应写入本表，仅作标志位）',
        \`is_public\` tinyint NOT NULL DEFAULT 0 COMMENT '是否可对外公开（如下发给前端）',
        \`is_editable\` tinyint NOT NULL DEFAULT 1 COMMENT '是否允许后台编辑（false 表示只读）',
        \`source\` enum('seed','manual','api') NOT NULL DEFAULT 'manual' COMMENT '配置来源: seed/manual/api',
        \`sort\` int NOT NULL DEFAULT 0 COMMENT '排序值（越小越靠前）',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_system_configs_uid\` (\`uid\`),
        UNIQUE INDEX \`UQ_system_configs_config_key\` (\`config_key\`),
        INDEX \`IDX_system_configs_group\` (\`config_group\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表'
    `);

    // ==================== audit: operation_logs ====================
    await queryRunner.query(`
      CREATE TABLE \`operation_logs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 oplog_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`request_id\` varchar(36) NULL COMMENT '请求唯一标识（UUID）',
        \`session_uid\` varchar(32) NULL COMMENT '会话标识 (JWT ID)',
        \`actor_id\` varchar(32) NULL COMMENT '操作者标识 (Subject)',
        \`actor_name\` varchar(50) NULL COMMENT '操作者名称',
        \`action\` varchar(100) NOT NULL COMMENT '操作行为',
        \`module\` varchar(50) NOT NULL COMMENT '操作模块',
        \`method\` varchar(10) NOT NULL COMMENT '请求方法',
        \`path\` varchar(255) NOT NULL COMMENT '请求路径',
        \`params\` json NULL COMMENT '请求参数',
        \`result\` json NULL COMMENT '响应结果',
        \`ip\` varchar(50) NULL COMMENT '请求IP',
        \`user_agent\` varchar(500) NULL COMMENT '用户代理原始字符串',
        \`device_type\` varchar(20) NULL COMMENT '设备类型: desktop/mobile/tablet/bot/unknown',
        \`browser\` varchar(50) NULL COMMENT '浏览器名称',
        \`browser_version\` varchar(30) NULL COMMENT '浏览器版本',
        \`os\` varchar(50) NULL COMMENT '操作系统',
        \`os_version\` varchar(30) NULL COMMENT '操作系统版本',
        \`country\` varchar(50) NULL COMMENT '国家',
        \`region\` varchar(50) NULL COMMENT '地区/省份',
        \`city\` varchar(50) NULL COMMENT '城市',
        \`status\` varchar(10) NOT NULL DEFAULT 'success' COMMENT '操作状态: success/failed',
        \`error_code\` varchar(50) NULL COMMENT '错误码',
        \`error_message\` text NULL COMMENT '错误信息',
        \`duration_ms\` int NULL COMMENT '响应耗时（毫秒）',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_operation_logs_uid\` (\`uid\`),
        INDEX \`IDX_operation_logs_module\` (\`module\`),
        INDEX \`IDX_operation_logs_action\` (\`action\`),
        INDEX \`IDX_operation_logs_actor_id\` (\`actor_id\`),
        INDEX \`IDX_operation_logs_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表'
    `);

    // ==================== task: tasks ====================
    await queryRunner.query(`
      CREATE TABLE \`tasks\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 task_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间 (UTC)',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间 (UTC)',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间 (UTC，软删除)',
        \`created_by\` varchar(32) NULL COMMENT '创建人UID',
        \`updated_by\` varchar(32) NULL COMMENT '更新人UID',
        \`created_by_username\` varchar(64) NULL COMMENT '创建人用户名',
        \`updated_by_username\` varchar(64) NULL COMMENT '更新人用户名',
        \`type\` varchar(100) NOT NULL COMMENT '任务类型（通用字符串）',
        \`biz_type\` varchar(64) NULL COMMENT '业务类型',
        \`biz_uid\` varchar(64) NULL COMMENT '业务 UID',
        \`status\` varchar(16) NOT NULL DEFAULT 'pending' COMMENT '任务状态（以小写字符串存储）',
        \`priority\` int NOT NULL DEFAULT 0 COMMENT '任务优先级（越大越优先）',
        \`attempt\` int NOT NULL DEFAULT 0 COMMENT '已尝试次数',
        \`max_attempt\` int NOT NULL DEFAULT 3 COMMENT '最大尝试次数',
        \`dedup_key\` varchar(255) NULL COMMENT '幂等键（唯一，可空）：用于跨创建+入队去重',
        \`target_version\` varchar(128) NULL COMMENT '目标版本',
        \`requested_version\` varchar(128) NULL COMMENT '请求版本',
        \`resolved_version\` varchar(128) NULL COMMENT '解析版本',
        \`depends_on_task_uid\` varchar(32) NULL COMMENT '依赖任务 UID',
        \`block_reason\` varchar(255) NULL COMMENT '阻塞原因',
        \`queue_name\` varchar(64) NULL COMMENT '队列名',
        \`worker_id\` varchar(64) NULL COMMENT 'Worker 标识',
        \`scheduled_at\` datetime(6) NULL COMMENT '计划执行时间（UTC）',
        \`started_at\` datetime(6) NULL COMMENT '开始执行时间（UTC）',
        \`finished_at\` datetime(6) NULL COMMENT '执行结束时间（UTC）',
        \`locked_by\` varchar(64) NULL COMMENT '认领者标识（workerId / hostname）',
        \`locked_at\` datetime(6) NULL COMMENT '认领时间（UTC）：用于 stale 卡死任务恢复判定',
        \`dispatched_at\` datetime(6) NULL COMMENT '已投递时间（UTC）：直接投递或 dispatcher 兜底投递后写入',
        \`input_json\` json NULL COMMENT '输入 JSON（任务负载）',
        \`stages_json\` json NULL COMMENT '阶段 JSON',
        \`output_json\` json NULL COMMENT '输出 JSON',
        \`error_code\` varchar(64) NULL COMMENT '错误码',
        \`error_message\` text NULL COMMENT '错误信息',
        \`source_type\` varchar(32) NULL COMMENT '来源类型（通用字符串）',
        \`trace_id\` varchar(64) NULL COMMENT '链路追踪 ID',
        \`name\` varchar(255) NULL COMMENT '任务名称（可空）',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_tasks_uid\` (\`uid\`),
        UNIQUE INDEX \`uq_tasks_dedup_key\` (\`dedup_key\`),
        INDEX \`idx_tasks_type_status_scheduled\` (\`type\`, \`status\`, \`scheduled_at\`),
        INDEX \`idx_tasks_biz\` (\`biz_type\`, \`biz_uid\`),
        INDEX \`idx_tasks_status_priority\` (\`status\`, \`priority\`, \`scheduled_at\`),
        INDEX \`idx_tasks_trace\` (\`trace_id\`),
        INDEX \`idx_tasks_status_dispatched_at\` (\`status\`, \`dispatched_at\`),
        INDEX \`idx_tasks_status_locked_at\` (\`status\`, \`locked_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表（通用富任务引擎）'
    `);

    // ==================== task: task_logs ====================
    await queryRunner.query(`
      CREATE TABLE \`task_logs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID（自增）',
        \`uid\` varchar(32) NOT NULL COMMENT '业务UID（含前缀，如 tasklog_xxx）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
        \`deleted_at\` datetime(6) NULL COMMENT '删除时间（软删除）',
        \`task_uid\` varchar(32) NOT NULL COMMENT '关联任务 UID',
        \`level\` varchar(20) NOT NULL COMMENT '日志级别（info|warn|error）',
        \`message\` text NOT NULL COMMENT '日志内容',
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_task_logs_uid\` (\`uid\`),
        INDEX \`IDX_task_logs_task_uid\` (\`task_uid\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务日志表'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 逆序删除（无显式外键约束，按依赖关系倒序）。
    await queryRunner.query('DROP TABLE IF EXISTS `task_logs`');
    await queryRunner.query('DROP TABLE IF EXISTS `tasks`');
    await queryRunner.query('DROP TABLE IF EXISTS `operation_logs`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_configs`');
    await queryRunner.query('DROP TABLE IF EXISTS `dictionary_items`');
    await queryRunner.query('DROP TABLE IF EXISTS `dictionaries`');
    await queryRunner.query('DROP TABLE IF EXISTS `role_menus`');
    await queryRunner.query('DROP TABLE IF EXISTS `role_permissions`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_roles`');
    await queryRunner.query('DROP TABLE IF EXISTS `menus`');
    await queryRunner.query('DROP TABLE IF EXISTS `permissions`');
    await queryRunner.query('DROP TABLE IF EXISTS `roles`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_security_events`');
    await queryRunner.query('DROP TABLE IF EXISTS `external_identities`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_sessions`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_credentials`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_profiles`');
    await queryRunner.query('DROP TABLE IF EXISTS `end_users`');
    await queryRunner.query('DROP TABLE IF EXISTS `admin_users`');
  }
}
