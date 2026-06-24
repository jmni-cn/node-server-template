# @domains/access-control

访问控制（RBAC）域库。提供角色、权限、菜单及其关联的管理服务，并实现
`@platform/auth` 的 `ACCESS_CHECKER` 端口供权限守卫使用。

## 依赖边界

仅依赖 `@core/*` 与 `@platform/*`（`@platform/cache`、`@platform/auth` 的 token/接口）。
不依赖任何兄弟域（domains）、integrations 或 apps。

## 模型

- 实体：`Role`、`Permission`、`Menu`，以及显式 join 表 `UserRole` / `RolePermission` / `RoleMenu`
  （由 service 维护，不使用 TypeORM ManyToMany）。
- 菜单为自引用树（`parentId` 引用 `Menu.uid`），类型见 `MenuType`。

## 服务

- `PermissionService`：权限增改查、分组聚合（`groupTree`）、`resolveUidsToIds`。
- `MenuService`：菜单增改删、整树（`tree`）、用户可见菜单树（`menusForUser`）。
- `RoleService`：角色 CRUD、授权（`assignPermissions` / `assignMenus`）、用户角色分配
  （`assignRolesToUser`）、用户权限码解析（`getPermissionCodesForUser`，经缓存）。
- `AccessCheckService`：实现 `AccessChecker`，`hasPermissions(userId, perms)`。

## ACCESS_CHECKER 绑定（关键）

`@platform/auth` 仅定义端口接口 `AccessChecker` 与注入 token `ACCESS_CHECKER`，
不提供实现。本模块在 providers 中将实现绑定到该 token：

```typescript
{ provide: ACCESS_CHECKER, useExisting: AccessCheckService }
```

并在 `exports` 中导出 `ACCESS_CHECKER`。因此 `@platform/auth` 的 `PermissionsGuard`
能够解析到 `AccessCheckService`。

## 应用如何暴露 ACCESS_CHECKER

应用（app）只需 `imports: [AccessControlModule]`。由于本模块已 `exports` 了
`ACCESS_CHECKER`（绑定为 `useExisting: AccessCheckService`），导入该模块的应用模块
即可让 `PermissionsGuard` 注入到 `ACCESS_CHECKER`，无需再自行绑定。

```typescript
import { Module } from '@nestjs/common';
import { AccessControlModule } from '@domains/access-control';
import { AuthModule } from '@platform/auth';

@Module({
  imports: [AuthModule, AccessControlModule],
})
export class AppModule {}
```

`ACCESS_CHECKER` 的主来源仍是 `@platform/auth`；为方便起见 barrel 也再导出该 token，
可 `import { ACCESS_CHECKER } from '@domains/access-control'`。

## 缓存

用户权限码经 `CacheService` 缓存：键 `user-perms:${userId}`，命名空间 `rbac`，
TTL 300 秒（见 `RBAC_CACHE`）。授权/角色分配变更时会失效相关用户缓存。
