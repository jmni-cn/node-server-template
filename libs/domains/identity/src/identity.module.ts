/**
 * IdentityModule — 身份域模块。
 *
 * 聚合管理员（AdminUser）、终端用户（EndUser）及共享卫星表（资料/凭证/会话/
 * 安全事件/外部身份）的实体与服务。共享卫星表通过 subjectType 区分主体归属。
 * 仅依赖 @core/* 与 @platform/*（security / queue），不依赖任何兄弟域。
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { registerErrorCodeHttpStatus } from '@core/common';
import { ConfigRuntimeModule } from '@platform/config';
import { SecurityModule } from '@platform/security';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';

import { AdminUser } from './entities/admin-user.entity';
import { EndUser } from './entities/end-user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserCredential } from './entities/user-credential.entity';
import { UserSession } from './entities/user-session.entity';
import { ExternalIdentity } from './entities/external-identity.entity';
import { SecurityEvent } from './entities/security-event.entity';

import { AdminUserService } from './services/admin-user.service';
import { EndUserService } from './services/end-user.service';
import { CredentialService } from './services/credential.service';
import { RegisterService } from './services/register.service';
import { LoginService } from './services/login.service';
import { SessionService } from './services/session.service';
import { ProfileService } from './services/profile.service';
import { ExternalIdentityService } from './services/external-identity.service';
import { SecurityEventService } from './services/security-event.service';
import { IdentityAccessSessionValidator } from './services/access-session-validator.service';
import { SecurityEventRecorderAdapter } from './services/security-event-recorder.adapter';
import { EndUserAssembler } from './assembler/end-user.assembler';

import { IdentityErrorCodeHttpStatus } from './constants/identity-error-codes';

// 模块加载时注册错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(IdentityErrorCodeHttpStatus);

/**
 * 注：本模块**非全局**。平台层端口（ACCESS_SESSION_VALIDATOR /
 * SECURITY_EVENT_RECORDER）的绑定已移出到独立的 `@Global`
 * {@link IdentitySecurityPortsModule}，以缩小全局面——本模块只导出领域服务，
 * 由各 feature 模块按需 import。`IdentityAccessSessionValidator` 与
 * `SecurityEventRecorderAdapter` 在此作为普通 provider 导出，供端口模块 useExisting。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      EndUser,
      UserProfile,
      UserCredential,
      UserSession,
      ExternalIdentity,
      SecurityEvent,
    ]),
    SecurityModule,
    ConfigRuntimeModule,
    QueueModule.registerQueues([QUEUE_NAMES.USER_EVENTS]),
  ],
  providers: [
    AdminUserService,
    EndUserService,
    CredentialService,
    RegisterService,
    LoginService,
    SessionService,
    ProfileService,
    ExternalIdentityService,
    SecurityEventService,
    IdentityAccessSessionValidator,
    SecurityEventRecorderAdapter,
    EndUserAssembler,
  ],
  exports: [
    AdminUserService,
    EndUserService,
    CredentialService,
    RegisterService,
    LoginService,
    SessionService,
    ProfileService,
    ExternalIdentityService,
    SecurityEventService,
    IdentityAccessSessionValidator,
    SecurityEventRecorderAdapter,
    EndUserAssembler,
    TypeOrmModule,
  ],
})
export class IdentityModule {}
