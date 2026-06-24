# @core/i18n

Internationalization on **nestjs-i18n**.

## Exports
- `I18nModule` — global; wraps `nestjs-i18n` `I18nModule.forRootAsync`, fallback language from `@core/config`, loader path at the bundled `messages/` dir, resolver chain from `locale.resolver`.
- `I18nService` — thin wrapper: `translate(key, opts)`, `translateError(code, lang)` (maps `error.<CODE>`).
- `localeResolvers` — query (`?lang=`) + header (`X-Lang`) + `Accept-Language`.
- `I18N_MESSAGES_PATH` — resolved runtime messages directory.

## Messages
`messages/en` and `messages/zh-CN`, each with `error.json` (keyed by `BaseErrorCode`/`CommonBusinessErrorCode`) and `common.json`.

## Build
`scripts/copy-i18n.js` copies `messages/` into `dist/apps/<APP_NAME>/i18n` and `dist/libs/core/i18n/messages`; referenced by the `build` npm scripts.
