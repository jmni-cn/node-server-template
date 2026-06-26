import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BusinessException } from '../exceptions/business.exception';
import { BaseErrorCode } from '../constants/base-error-codes';

/** 排序方向。 */
export type SortOrder = 'ASC' | 'DESC';

/** 分页每页条数上限（防止超大页拖垮数据库 / 内存）。 */
export const MAX_PAGE_SIZE = 100;

/**
 * 分页查询 DTO
 *
 * @example
 * ```typescript
 * class ListUsersDto extends PaginationDto {
 *   @ApiPropertyOptional()
 *   @IsOptional()
 *   keyword?: string;
 * }
 * ```
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: '页码',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: '排序字段（必须在业务白名单内，由各 service 用 assertSortWhitelist 校验）',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: '排序方向',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: SortOrder = 'DESC';
}

/**
 * 强制 sortBy 落在业务白名单内（防 SQL 注入 / 任意字段排序）。
 *
 * - sortBy 为空 → 直接放行（业务可回退到默认排序字段）；
 * - sortBy 不在白名单 → 抛 `REQ_PARAM_INVALID`。
 *
 * @param sortBy  客户端传入的排序字段（可空）。
 * @param allowed 允许排序的字段白名单。
 * @returns 校验通过的 sortBy（或 undefined）。
 *
 * @example
 * ```typescript
 * const sortBy = assertSortWhitelist(dto.sortBy, ['createdAt', 'username']);
 * ```
 */
export function assertSortWhitelist(
  sortBy: string | undefined,
  allowed: readonly string[],
): string | undefined {
  if (!sortBy) {
    return undefined;
  }
  if (!allowed.includes(sortBy)) {
    throw new BusinessException(BaseErrorCode.REQ_PARAM_INVALID, {
      field: 'sortBy',
      value: sortBy,
      allowed,
    });
  }
  return sortBy;
}
