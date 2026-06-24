# @core/config

Centralized configuration: wraps `@nestjs/config`, loads namespaces, Joi-validates env.

## Module
`AppConfigModule` — global. Loads all namespaces, validates with the merged Joi schema,
reads `env/<APP_NAME>.local.env` in development, real env in production.

## Namespaces
`app`, `database` (MySQL), `redis`, `jwt` (access+refresh), `sso` (OIDC issuer/clientId/secret/redirect/scope),
`queue` (BullMQ redis connection + concurrency), `logger`, `i18n`.

Each exports `xxxConfig` (`registerAs`), `xxxConfigSchema` (Joi fragment) and `XxxConfigType`.
`configNamespaces` is the array for `ConfigModule.forRoot({ load })`; `allConfigSchemas` merges the fragments;
`configValidationSchema` is the built `Joi.object`.
