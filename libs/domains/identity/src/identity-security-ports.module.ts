/**
 * IdentitySecurityPortsModule — 平台层安全端口的绑定模块（@Global）。
 *
 * 把 @platform/auth 定义的两个端口绑定到 identity 域的实现，并以 @Global 导出，
 * 使它们能被 @platform/auth 内部实例化的消费者解析到：
 * - `ACCESS_SESSION_VALIDATOR` → {@link IdentityAccessSessionValidator}
 *   （admin/user JWT 策略在 `AuthModule.forRoot()` 自身上下文实例化，看不到 app 根模块的
 *   局部 provider，故端口必须经全局导出才能被注入）。
 * - `SECURITY_EVENT_RECORDER` → {@link SecurityEventRecorderAdapter}（PermissionsGuard 消费）。
 *
 * 设计意图：把"全局面"收敛到这个**只导出两个端口 token** 的小模块，
 * 而非让整个 IdentityModule 变成 @Global。app 只需在根模块 import 本模块一次。
 */

import { Global, Module } from '@nestjs/common';
import { ACCESS_SESSION_VALIDATOR, SECURITY_EVENT_RECORDER } from '@platform/auth';
import { IdentityModule } from './identity.module';
import { IdentityAccessSessionValidator } from './services/access-session-validator.service';
import { SecurityEventRecorderAdapter } from './services/security-event-recorder.adapter';

@Global()
@Module({
  imports: [IdentityModule],
  providers: [
    { provide: ACCESS_SESSION_VALIDATOR, useExisting: IdentityAccessSessionValidator },
    { provide: SECURITY_EVENT_RECORDER, useExisting: SecurityEventRecorderAdapter },
  ],
  exports: [ACCESS_SESSION_VALIDATOR, SECURITY_EVENT_RECORDER],
})
export class IdentitySecurityPortsModule {}
