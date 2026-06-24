/**
 * EndUserAssembler — 终端用户详情组装器。
 *
 * 组装 `EndUserDetailVo`（EndUserVo + UserProfileVo），以 `EndUser` 实体为入参。
 *
 * 说明：此处直接注入 UserProfile 仓储仅用于只读关联查询，避免
 * ProfileService → EndUserService → EndUserAssembler → ProfileService 的循环依赖。
 * 组装逻辑无写副作用。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EndUser } from '../entities/end-user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { EndUserDetailVo } from '../vo/end-user.vo';
import { EndUserMapper } from '../mapper/end-user.mapper';
import { UserProfileMapper } from '../mapper/user-profile.mapper';

@Injectable()
export class EndUserAssembler {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
  ) {}

  /** 组装终端用户详情 VO（资料缺失时 profile 为 null）。 */
  async toDetailVo(user: EndUser): Promise<EndUserDetailVo> {
    const base = EndUserMapper.toVo(user);
    const detail = new EndUserDetailVo();
    Object.assign(detail, base);
    const profile = await this.profileRepository.findOne({
      where: { userId: user.uid },
    });
    detail.profile = profile ? UserProfileMapper.toVo(profile) : null;
    return detail;
  }
}
