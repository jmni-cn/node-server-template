# Changelog

All notable changes to this template are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/) and
[Conventional Commits](https://www.conventionalcommits.org/).

## [1.0.0] - Template baseline

### Added
- NestJS 11 + TypeORM (MySQL) + Fastify monorepo base.
- Apps: `admin-api`, `user-api`, `worker`.
- Layered libs: `core/*`, `platform/*`, `domains/*`, `integrations/*`.
- Platform capabilities: auth (JWT access/refresh), RBAC access-control, system
  config & dictionaries, audit/operation-log, BullMQ queue + worker, scheduled tasks,
  rate limiting, structured logging, request context, i18n, SSO (OAuth2/OIDC) base.
- Database migrations, seeds (super admin, base roles/permissions/menus, system configs,
  dictionaries), and factories.
- Architecture guardrails: `check-boundaries`, `check-layer-rules`,
  custom eslint rules, `.cursor/rules`, and `references/*` specs.
- Docker (per-app Dockerfiles + dev/test/prod compose), deploy samples (pm2/k8s/systemd),
  CI workflows, and a full test scaffold.
