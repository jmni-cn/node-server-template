# database/

数据库层：TypeORM CLI 数据源、迁移、种子数据与测试工厂。

## 目录

```
database/
  data-source.ts        # TypeORM CLI 数据源（migration / seed / db:reset 复用）
  migrations/           # 迁移文件（schema 唯一来源）
    1700000000000-InitSchema.ts
  seeds/                # 种子数据（模板基础数据）
    seed.ts             # 编排器
    seed-permissions.ts # 权限 / 角色 / 菜单 + 绑定
    seed-admin.ts       # 超级管理员账户 + 凭证 + 资料 + 角色绑定
    seed-system-configs.ts
    seed-dictionaries.ts
  factories/            # 测试用实体工厂（纯函数，返回 DeepPartial）
    user.factory.ts
    role.factory.ts
```

## 核心规则

- **`synchronize: false` 恒成立。** 任何 schema 变更都必须通过 `database/migrations` 下的迁移完成，
  禁止依赖实体自动同步。
- **迁移是 schema 的唯一真相来源。** 初始迁移 `InitSchema` 覆盖全部基础表
  （users / user_profiles / user_credentials / user_sessions / external_identities /
  roles / permissions / menus / user_roles / role_permissions / role_menus /
  dictionaries / dictionary_items / system_configs / operation_logs / tasks / task_logs）。
- **seeds 只放模板基础数据**（内置角色、权限点、菜单、默认管理员、基础配置/字典）。
  不放业务/演示数据。所有 seed 必须**幂等**（以唯一编码查重后再插入）。
- **factories 仅供测试**，不参与运行时；纯函数、无副作用、不持有 DataSource。

## 常用命令

```bash
# 生成/创建迁移
npm run migration:create -- database/migrations/SomeChange   # 空迁移
npm run migration:generate -- database/migrations/SomeChange  # 由实体差异生成

# 执行 / 回滚 / 查看迁移
npm run migration:run
npm run migration:revert
npm run migration:show

# 填充种子数据（幂等）
npm run seed

# 开发期重置（drop + create + migrate + seed）—— 禁止在生产运行
npm run db:reset
```

迁移表名为 `migrations`（见 `data-source.ts` 覆盖）。

## 环境变量

`data-source.ts` 通过 dotenv 加载 `env/<APP_NAME>.local.env`（其次 `env/<APP_NAME>.env`），
默认 `APP_NAME=admin-api`。需要的键：`DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` /
`DB_DATABASE`（可选 `DB_CHARSET` / `DB_TIMEZONE` / `DB_LOGGING`）。

## 默认管理员凭证

`seed-admin` 创建的超级管理员（首次登录后请立即修改密码）：

| 字段 | 值 |
|------|----|
| username | `admin` |
| email | `admin@example.com` |
| password | `Admin@123456`（bcryptjs 哈希存储） |
| role | `SUPER_ADMIN`（绑定全部权限 + 菜单） |
