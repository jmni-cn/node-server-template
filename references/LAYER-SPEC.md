# LAYER-SPEC

The monorepo is organized into four library layers plus the apps. Dependencies
flow in one direction only. This is enforced by `npm run check:layers`
(`scripts/check-layer-rules.ts`) and the custom ESLint rules in `tools/eslint-rules`.

## The four layers

| Layer | Alias | What lives here |
|-------|-------|-----------------|
| **core** | `@core/<name>` | Framework-agnostic infrastructure: common (response envelope, errors, utils), config, database (BaseEntity), logger, request-context, i18n. |
| **platform** | `@platform/<name>` | Cross-cutting capabilities bound to no business domain: auth (JWT/guards/ACCESS_CHECKER port), security (rate-limit/password/ip/device), cache, queue (BullMQ), audit, task, health. |
| **domains** | `@domains/<name>` | Business domains: identity (users/sessions/credentials/external-identity), access-control (RBAC), system (config/dictionaries). Owns entities + repositories + business services. |
| **integrations** | `@integrations/<name>` | Outward-facing third-party integrations: sso (OAuth2/OIDC adapters). |
| **apps** | — | Deployables: admin-api, user-api, worker. Controllers, bootstrap, feature modules, queue processors. |

Inside any lib, the internal structure is fixed (see CONVENTIONS.md §3):
`entities / dto / vo / mapper / assembler / services / types / constants / index.ts`.

## Dependency direction (allowed imports)

```
apps         -> @core, @platform, @domains, @integrations
integrations -> @core, @platform, @domains
domains      -> @core, @platform                (NOT other domains, NOT integrations, NOT apps)
platform     -> @core                           (NOT domains, NOT integrations, NOT apps)
core         -> @core only                      (leaf layer)
```

## Hard rules

- **A lib never imports "up".** platform must not reach into domains; domains
  must not reach into integrations or apps.
- **domains do not import each other.** If identity needs an access-control
  concept, expose it through a shared type in `@core` or invert via a port, not
  a direct domain-to-domain import.
- **platform stays domain-agnostic.** `@platform/auth` does not know what a
  "permission" row looks like; it defines the `ACCESS_CHECKER` port and the app
  binds a domain implementation to it.
- **apps never import each other.** admin-api / user-api / worker are isolated
  deployables (enforced by `no-cross-app-import`).
- **apps never inject a repository.** Apps call domain/platform services only
  (enforced by `no-app-repository-import`). If a method is missing, add it to
  the domain service and export it — see MODULE-SPEC.md.
- Every lib re-exports its public surface from `src/index.ts`. Import from the
  alias barrel (`@domains/identity`), not deep relative paths.
