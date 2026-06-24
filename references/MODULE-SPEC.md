# MODULE-SPEC

How to add an **app feature module** (admin-api / user-api). A feature module is
a thin HTTP layer: it wires controllers, declares DTOs/VOs, and delegates all
work to domain/platform services. It contains no business logic and no data
access.

## Anatomy

```
apps/<app>/src/modules/<feature>/
  <feature>.module.ts          imports domain/platform modules, declares controllers + app services
  <name>.controller.ts         routes; HTTP transport; calls ONE app/domain service; returns VO or void
  <feature>.service.ts         app application service (optional) — composes multiple lib services
  dto/                         request DTOs (class-validator) — what comes in over HTTP
  vo/                          view objects returned to clients (Swagger @ApiProperty)
```

## Application-service layer (keep controllers thin)

A controller method that orchestrates **more than one lib service** or contains
business branching (status checks, token issuance, session rotation, security-event
recording, …) must delegate to an **app application service**
(`<feature>.service.ts`, a plain `@Injectable()` registered in the module
`providers`). The application service composes lib services from
`@core`/`@platform`/`@domains`/`@integrations` and may read
`RequestContextService` for ip/userAgent. Like controllers, it **never injects a
repository** and **never imports another app**. **HTTP transport (cookies/`@Res`/
redirects) stays in the controller** — the app service returns plain data and the
controller does the I/O and VO mapping. A pure single-call delegation
(controller → one domain method → VO) needs no app service.

### Before (orchestration in the controller — NOT allowed)

```typescript
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: FastifyReply) {
  const user = await this.loginService.verifyCredentials('user', dto.identifier, dto.password, {
    ip: RequestContextService.getIp() ?? null,
    userAgent: RequestContextService.getUserAgent() ?? null,
  });
  const jti = randomUUID();
  const tokens = await this.tokenService.issueTokens({ /* build payloads */ });
  await this.sessionService.create({ subjectType: 'user', userId: user.uid, jti, refreshToken: tokens.refreshToken, /* … */ });
  setRefreshTokenCookie(res, tokens.refreshToken, this.cookieOptions());
  return { accessToken: tokens.accessToken, tokenType: 'Bearer' };
}
```

### After (orchestration in the app service; controller is thin)

```typescript
// user-auth.service.ts — composes LoginService + TokenService + SessionService
async login(dto: LoginDto): Promise<AuthSession> {
  const user = await this.loginService.verifyCredentials('user', dto.identifier, dto.password, {
    ip: RequestContextService.getIp() ?? null,
    userAgent: RequestContextService.getUserAgent() ?? null,
  });
  return this.issueAndPersist(user.uid, user.username, user.passwordVersion);
  // returns { accessToken, refreshToken, refreshExpiresAt } — plain data, no HTTP
}

// user-auth.controller.ts — request parse + ONE service call + cookie I/O + VO
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: FastifyReply): Promise<AuthTokenVo> {
  const session = await this.authService.login(dto);
  setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions()); // transport stays here
  return { accessToken: session.accessToken, tokenType: 'Bearer' };
}
```

Generate the skeleton with `scripts/create-module.ts` (templates in
`tools/generators/module-template`).

## Rules (enforced by ESLint + check scripts)

1. **Controllers call services only.** No `@InjectRepository`, no
   `getRepository`, no TypeORM in apps. If the needed operation does not exist,
   add a method to the domain service and export it from the lib's `index.ts`
   (see LAYER-SPEC.md), then call it. Never reach into a repo "to get it working".
2. **Return a VO, never an entity.** Controllers return a VO (or `void`).
   Mapping entity -> VO happens in the lib's `mapper`/`assembler`, not in the
   controller (enforced by `no-entity-response`).
3. **No business logic in controllers.** Validation lives in DTOs; orchestration
   lives in services; composition of multiple sources lives in assemblers.
4. **Module imports the lib module.** e.g. an admin users module imports
   `IdentityModule` from `@domains/identity` and injects its services.
5. **Decorate writes and sensitive routes.** Apply `@OperationLogDecorator(...)`
   to write endpoints, `@RateLimit(...)` to login/register/password/sso,
   `@Permissions(...)` to admin endpoints. Open public routes with `@Public()`.

## Example controller (admin-api)

```typescript
@ApiTags('Users')
@Controller('users') // -> /admin/users (global prefix 'admin')
export class AdminUsersController {
  constructor(private readonly userService: UserService) {} // from @domains/identity

  @Get(':uid')
  @Permissions('rbac:user:read')
  @ApiBaseResponse(UserVo)
  async findOne(@Param('uid') uid: string): Promise<UserVo> {
    return this.userService.findVoByUid(uid); // service returns a VO
  }

  @Post()
  @Permissions('rbac:user:write')
  @OperationLogDecorator({ action: 'CREATE_USER', module: 'Users' })
  @ApiBaseResponse(UserVo)
  async create(@Body() dto: CreateUserDto): Promise<UserVo> {
    return this.userService.createUser(dto);
  }
}
```

The `TransformInterceptor` wraps the returned VO in the unified envelope
(API-SPEC.md); the controller just returns the VO.
