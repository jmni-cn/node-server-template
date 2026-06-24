/**
 * EndUserService — 终端用户主体服务（END-ONLY）。
 *
 * 拥有 EndUser 仓储，负责终端用户的创建、查询、列表、更新与登录时间维护。
 * 详情（含资料）通过 EndUserAssembler 组装。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException, createPageResult } from '@core/common';
import type { PageResultVo } from '@core/common';
import { EndUser } from '../entities/end-user.entity';
import { EndUserVo, EndUserDetailVo } from '../vo/end-user.vo';
import { EndUserMapper } from '../mapper/end-user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUserDto } from '../dto/list-user.dto';
import { EndUserAssembler } from '../assembler/end-user.assembler';
import { IdentityErrorCode } from '../constants/identity-error-codes';

@Injectable()
export class EndUserService {
  constructor(
    @InjectRepository(EndUser)
    private readonly endUserRepository: Repository<EndUser>,
    private readonly endUserAssembler: EndUserAssembler,
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
    return this.endUserRepository.save(user);
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

  /** 更新终端用户基础信息。 */
  async update(uid: string, dto: UpdateUserDto): Promise<EndUserVo> {
    const user = await this.findByUid(uid);
    if (dto.email !== undefined) user.email = dto.email ?? null;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.status !== undefined) user.status = dto.status;
    const saved = await this.endUserRepository.save(user);
    return EndUserMapper.toVo(saved);
  }

  /** 更新最后登录时间（可选记录登录 IP）。 */
  async updateLastLogin(uid: string, ip?: string | null): Promise<void> {
    await this.endUserRepository.update(
      { uid },
      { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
    );
  }

  /** 递增密码版本号（pv），使旧令牌失效。 */
  async incrementPasswordVersion(uid: string): Promise<void> {
    await this.endUserRepository.increment({ uid }, 'passwordVersion', 1);
  }
}
