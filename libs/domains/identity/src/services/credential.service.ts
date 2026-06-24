/**
 * CredentialService — 密码凭证服务（subjectType 感知）。
 *
 * 拥有 UserCredential 仓储，统一负责 admin / user 两类主体的密码哈希写入与校验。
 * 通过 (subjectType, userId) 定位凭证。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordHasherService } from '@platform/security';
import { UserCredential } from '../entities/user-credential.entity';
import type { SubjectType } from '../types/subject-type';

@Injectable()
export class CredentialService {
  constructor(
    @InjectRepository(UserCredential)
    private readonly credentialRepository: Repository<UserCredential>,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  /**
   * 写入/更新主体密码（不存在则创建，存在则覆盖哈希）。
   * 明文经 bcrypt 哈希后落库，并刷新 passwordUpdatedAt。
   */
  async setPassword(
    subjectType: SubjectType,
    userId: string,
    plain: string,
  ): Promise<UserCredential> {
    const passwordHash = await this.passwordHasher.hash(plain);
    let credential = await this.credentialRepository.findOne({
      where: { subjectType, userId },
    });
    if (credential) {
      credential.passwordHash = passwordHash;
      credential.passwordUpdatedAt = new Date();
    } else {
      credential = this.credentialRepository.create({
        subjectType,
        userId,
        passwordHash,
        passwordUpdatedAt: new Date(),
      });
    }
    return this.credentialRepository.save(credential);
  }

  /**
   * 校验主体密码。凭证不存在或不匹配均返回 false（不抛错，由调用方决定语义）。
   */
  async verify(
    subjectType: SubjectType,
    userId: string,
    plain: string,
  ): Promise<boolean> {
    const credential = await this.credentialRepository.findOne({
      where: { subjectType, userId },
    });
    if (!credential) return false;
    return this.passwordHasher.compare(plain, credential.passwordHash);
  }

  /** 主体是否已设置凭证。 */
  async exists(subjectType: SubjectType, userId: string): Promise<boolean> {
    const count = await this.credentialRepository.count({
      where: { subjectType, userId },
    });
    return count > 0;
  }
}
