# @domains/__name__

__Name__ 域库。仅依赖 `@core/*` 与 `@platform/*`（禁止依赖其它 `@domains` / `@integrations` / `apps`）。

## 分层

```
src/
  entities/    TypeORM 实体（继承 BaseEntity / SystemBaseEntity）
  dto/         输入 DTO（class-validator）
  vo/          返回给控制器的视图对象（@ApiProperty）
  mapper/      纯函数 entity<->vo/dto 映射（无 DI、无 IO）
  assembler/   组合多个 mapper/来源（可注入 service）
  services/    业务逻辑；唯一可注入 repository 的层
  types/       共享类型
  constants/   错误码 / token / 枚举
  index.ts     公共 barrel
```

## 接入清单（生成后手动完成）

1. 在 `tsconfig.base.json` 的 `paths` 添加：
   ```json
   "@domains/__name__": ["libs/domains/__name__/src/index.ts"],
   "@domains/__name__/*": ["libs/domains/__name__/src/*"]
   ```
2. 在 `nest-cli.json` 的 `projects` 添加 `__name__` 库项（type: library，tsConfigPath 指向本目录 tsconfig.lib.json）。
3. 若有测试，确认 jest `moduleNameMapper` 覆盖新别名。
4. 在用到的 app `AppModule` 引入 `__Name__Module`。
