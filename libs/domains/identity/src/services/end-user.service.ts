/**
 * EndUserService — 终端用户主体服务（END-ONLY）。
 *
 * 拥有 EndUser 仓储，负责终端用户的创建、查询、列表、更新与登录时间维护。
 * 详情（含资料）通过 EndUserAssembler 组装。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException, createPageResult, maskIp } from '@core/common';
import type { PageResultVo } from '@core/common';
import { EndUser } from '../entities/end-user.entity';
import { EndUserVo, EndUserDetailVo } from '../vo/end-user.vo';
import { EndUserMapper } from '../mapper/end-user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUserDto } from '../dto/list-user.dto';
import { EndUserAssembler } from '../assembler/end-user.assembler';
import { SessionService } from './session.service';
import { SecurityEventService } from './security-event.service';
import { UserStatus } from '../entities/user-status.enum';
import { IdentityErrorCode } from '../constants/identity-error-codes';

const SUBJECT = 'user' as const;

@Injectable()
export class EndUserService {
  constructor(
    @InjectRepository(EndUser)
    private readonly endUserRepository: Repository<EndUser>,
    private readonly endUserAssembler: EndUserAssembler,
    private readonly sessionService: SessionService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /** 创建终端用户（用户名/邮箱/手机号唯一性校验）。返回实体。 */
  async create(dto: CreateUserDto): Promise<EndUser> {
    if (dto.username) {
      const existingByUsername = await this.findByUsername(dto.username);
      if (existingByUsername) {
        throw new BusinessException(IdentityErrorCode.USER_USERNAME_TAKEN);
      }
    }
    if (dto.email) {
      const existingByEmail = await this.findByEmail(dto.email);
      if (existingByEmail) {
        throw new BusinessException(IdentityErrorCode.USER_EMAIL_TAKEN);
      }
    }
    if (dto.phone) {
      const existingByPhone = await this.findByPhone(dto.phone);
      if (existingByPhone) {
        throw new BusinessException(IdentityErrorCode.USER_PHONE_TAKEN);
      }
    }

    const user = this.endUserRepository.create({
      username: dto.username ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      nickname: dto.nickname ?? null,
    });
    try {
      return await this.endUserRepository.save(user);
    } catch (err) {
      // 前置 findBy* 检查与 save 之间存在竞态窗口，并发请求可能同时通过检查。
      // 数据库唯一约束是最终防线：捕获 MySQL 唯一冲突并按违反的列重抛具体业务错误。
      throw this.rethrowAsConflict(err, dto);
    }
  }

  /**
   * 将 MySQL 唯一约束冲突（ER_DUP_ENTRY / errno 1062）按违反的列映射为具体业务错误：
   * username → USER_USERNAME_TAKEN，email → USER_EMAIL_TAKEN，phone → USER_PHONE_TAKEN。
   * 无法判定具体列时回退到 USER_USERNAME_TAKEN（终端用户最常见的唯一标识）；
   * 非唯一冲突错误原样抛出。
   */
  private rethrowAsConflict(err: unknown, dto: CreateUserDto): unknown {
    const e = err as { code?: string; errno?: number; sqlMessage?: string };
    const isDup = e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
    if (!isDup) return err;

    const msg = (e?.sqlMessage ?? '').toLowerCase();
    if (msg.includes('email') || (dto.email && msg.includes(dto.email.toLowerCase()))) {
      return new BusinessException(IdentityErrorCode.USER_EMAIL_TAKEN);
    }
    if (msg.includes('phone') || (dto.phone && msg.includes(dto.phone.toLowerCase()))) {
      return new BusinessException(IdentityErrorCode.USER_PHONE_TAKEN);
    }
    return new BusinessException(IdentityErrorCode.USER_USERNAME_TAKEN);
  }

  /** 按 UID 查询终端用户（不存在抛 END_USER_NOT_FOUND）。 */
  async findByUid(uid: string): Promise<EndUser> {
    const user = await this.endUserRepository.findOne({ where: { uid } });
    if (!user) {
      throw new BusinessException(IdentityErrorCode.END_USER_NOT_FOUND);
    }
    return user;
  }

  /** 按用户名查询（不存在返回 null）。 */
  async findByUsername(username: string): Promise<EndUser | null> {
    return this.endUserRepository.findOne({ where: { username } });
  }

  /** 按邮箱查询（不存在返回 null）。 */
  async findByEmail(email: string): Promise<EndUser | null> {
    return this.endUserRepository.findOne({ where: { email } });
  }

  /** 按手机号查询（不存在返回 null）。 */
  async findByPhone(phone: string): Promise<EndUser | null> {
    return this.endUserRepository.findOne({ where: { phone } });
  }

  /** 查询终端用户详情 VO（含资料）。 */
  async getDetail(uid: string): Promise<EndUserDetailVo> {
    const user = await this.findByUid(uid);
    return this.endUserAssembler.toDetailVo(user);
  }

  /** 分页查询终端用户列表。 */
  async list(dto: ListUserDto): Promise<PageResultVo<EndUserVo>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const qb = this.endUserRepository.createQueryBuilder('user');
    if (dto.keyword) {
      qb.andWhere(
        '(user.username LIKE :kw OR user.email LIKE :kw OR user.phone LIKE :kw)',
        { kw: `%${dto.keyword}%` },
      );
    }
    if (dto.status) {
      qb.andWhere('user.status = :status', { status: dto.status });
    }
    qb.orderBy('user.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return createPageResult(
      EndUserMapper.toVoArray(items),
      total,
      page,
      pageSize,
    );
  }

  /**
   * 更新终端用户基础信息。
   *
   * 安全：当 status 由 ACTIVE 变为非 ACTIVE（禁用/锁定/封禁）时，即时使该用户下线——
   * 撤销其全部会话 + 递增密码版本（pv），令在途的 access token 在下次请求时被
   * ACCESS_SESSION_VALIDATOR 的 pv 校验拒绝，避免被禁用账号继续凭旧令牌访问。
   */
  async update(uid: string, dto: UpdateUserDto): Promise<EndUserVo> {
    const user = await this.findByUid(uid);
    const wasActive = user.status === UserStatus.ACTIVE;
    if (dto.email !== undefined) user.email = dto.email ?? null;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.status !== undefined) user.status = dto.status;
    const becameInactive = wasActive && user.status !== UserStatus.ACTIVE;
    const saved = await this.endUserRepository.save(user);

    if (becameInactive) {
      await this.sessionService.revokeAllForUser(SUBJECT, saved.uid, 'disabled');
      await this.incrementPasswordVersion(saved.uid);
      await this.securityEventService.record({
        subjectType: SUBJECT,
        userId: saved.uid,
        eventType: 'ACCOUNT_DISABLED',
        riskLevel: 'high',
        metadata: { status: saved.status },
      });
    }

    return EndUserMapper.toVo(saved);
  }

  /** 更新最后登录时间（登录 IP 统一脱敏后落库）。 */
  async updateLastLogin(uid: string, ip?: string | null): Promise<void> {
    await this.endUserRepository.update(
      { uid },
      { lastLoginAt: new Date(), lastLoginIp: maskIp(ip) },
    );
  }

  /** 递增密码版本号（pv），使旧令牌失效。 */
  async incrementPasswordVersion(uid: string): Promise<void> {
    await this.endUserRepository.increment({ uid }, 'passwordVersion', 1);
  }

  /**
   * 累计一次登录失败：failedLoginCount+1 并刷新 lastFailedLoginAt，
   * 返回累计后的失败次数（供调用方判定是否需要锁定）。
   */
  async incrementFailedLogin(uid: string): Promise<number> {
    await this.endUserRepository.increment({ uid }, 'failedLoginCount', 1);
    await this.endUserRepository.update(
      { uid },
      { lastFailedLoginAt: new Date() },
    );
    const user = await this.endUserRepository.findOne({
      where: { uid },
      select: ['uid', 'failedLoginCount'],
    });
    return user?.failedLoginCount ?? 0;
  }

  /** 重置登录失败计数与锁定状态（成功登录后调用）。 */
  async resetFailedLogin(uid: string): Promise<void> {
    await this.endUserRepository.update(
      { uid },
      { failedLoginCount: 0, lockedUntil: null },
    );
  }

  /** 锁定账户至指定分钟后（写入 lockedUntil）。 */
  async lockUser(uid: string, lockMinutes: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    await this.endUserRepository.update({ uid }, { lockedUntil });
  }
}
