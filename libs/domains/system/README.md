# @domains/system

系统域（System Domain）库，提供 **字典（Dictionary）** 与 **系统配置（System Config）** 两大能力。

## 能力

- **字典管理**：维护字典（`Dictionary`）与字典项（`DictionaryItem`），支持按 code 缓存读取启用项。
- **系统配置**：基于 key 的键值配置（`SystemConfig`），支持类型化解析（string/number/boolean/json）、分组、分页查询，读取走缓存。

## 依赖约束

仅依赖 `@core/*` 与 `@platform/*`，不依赖任何兄弟域 / integrations / apps。

## 导出

- 模块：`SystemModule`
- 服务：`DictionaryService`、`SystemConfigService`
- 装配器：`DictionaryAssembler`
- 实体：`Dictionary`、`DictionaryItem`、`SystemConfig`（含枚举 `DictionaryItemStatus`、`SystemConfigType`）
- DTO / VO / Mapper / Types / Constants

## 缓存

命名空间 `system`，字典项与配置默认 TTL 300 秒（见 `SYSTEM_CACHE`）。

## 使用

```typescript
import { SystemModule } from '@domains/system';

@Module({ imports: [SystemModule] })
export class AppModule {}
```
