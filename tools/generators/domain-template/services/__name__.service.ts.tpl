import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { __Name__ } from '../entities';

/**
 * __Name__Service — __name__ 域业务逻辑。
 *
 * service 是唯一可注入 repository 的层。不触碰 HTTP（无 @Req / Reply）。
 * 对外暴露的方法应通过域 barrel（index.ts）导出，供 apps 调用。
 */
@Injectable()
export class __Name__Service {
  constructor(
    @InjectRepository(__Name__)
    private readonly __name__Repo: Repository<__Name__>,
  ) {}

  async findAll(): Promise<__Name__[]> {
    return this.__name__Repo.find();
  }
}
