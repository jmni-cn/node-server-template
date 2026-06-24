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
import { EndUserAssembler } from './assembler/end-user.assembler';

import { IdentityErrorCodeHttpStatus } from './constants/identity-error-codes';

// 模块加载时注册错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(IdentityErrorCodeHttpStatus);

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
    EndUserAssembler,
    TypeOrmModule,
  ],
})
export class IdentityModule {}
