# @platform/config

Runtime configuration infrastructure for the platform layer — powers **business/security config hot-update (DB override)**.

## Provides

- **`SystemConfig`** entity (table `system_configs`, `uidPrefix='cfg'`) — owns the config table. Columns include `key / value / type / group / description / label / enabled / is_secret / is_public / is_editable / source / sort`.
- **`ConfigDefinition`** registry — `registerConfigDefinitions(defs)`, `getConfigDefinition(key)`, `getAllConfigDefinitions()`. Consumer libs register their keys (default value, flags) on module init. Mirrors `@core/common`'s `registerErrorCodeHttpStatus` pattern.
- **`RuntimeConfigService`** — fail-safe typed getters + source tracking + multi-level cache + write-invalidate.
- **`ConfigRuntimeModule`** — **non-global**; consumers each `import` it explicitly.

## Resolution order

```
DB row (enabled, non-null) → code default (def.defaultValue ?? passed default)
```

Two layers only: a DB override wins; otherwise the code default (registry `def.defaultValue`, or the value passed to the getter) is the baseline. There is **no env layer** for these hot-update keys.

## Getters (fail-safe, never throw)

```ts
constructor(private readonly cfg: RuntimeConfigService) {}

const max = await this.cfg.getNumber('security.login.maxFailedAttempts', 5);
const on  = await this.cfg.getBoolean('feature.signup.enabled', true);
const obj = await this.cfg.getJson<MyShape>('some.json.key', {});

// With source tracking:
const r = await this.cfg.resolveWithSource<number>('security.login.maxFailedAttempts');
// r => { value, source: 'db'|'code_default'|'disabled_fallback'|'error_fallback', behavior? }
```

## Write API (centralized invalidation)

```ts
await this.cfg.set('feature.signup.enabled', true, { group: 'feature', label: '开放注册' });
await this.cfg.delete('feature.signup.enabled'); // soft delete + invalidate
```

`set` of a key marked `isSecret` is **rejected** — secrets (clientSecret / JWT keys / salts) never go to DB; they stay in env + startup-time Joi validation.

## Caching

- Process-local Map (TTL ~30s, negative cache ~10s) → Redis (TTL ~300s, includes negative cache) → DB.
- `set` / `delete` write to DB then `invalidate(key)` clears both cache tiers (write-time invalidation for hot-update consistency).

## Layer

`@platform/config` depends only on `@platform/cache` and the `SystemConfig` entity (`@core/database` `BaseEntity`). It **must not** depend on `@domains/*` or `@integrations/*` (it is a low-level infra lib consumed by them). Non-global module; import where needed.
