import { ApiProperty } from '@nestjs/swagger';

/**
 * 分页元数据 VO
 */
export class PageMetaVo {
  @ApiProperty({ description: '当前页码', example: 1 })
  page: number;

  @ApiProperty({ description: '每页条数', example: 10 })
  pageSize: number;

  @ApiProperty({ description: '总条数', example: 100 })
  total: number;

  @ApiProperty({ description: '总页数', example: 10 })
  totalPages: number;

  @ApiProperty({ description: '是否有下一页', example: true })
  hasNext: boolean;

  @ApiProperty({ description: '是否有上一页', example: false })
  hasPrevious: boolean;
}

/**
 * 分页结果 VO
 */
export class PageResultVo<T> {
  @ApiProperty({ description: '数据列表' })
  items: T[];

  @ApiProperty({ description: '分页元数据', type: PageMetaVo })
  meta: PageMetaVo;
}

/**
 * 创建分页结果
 */
export function createPageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResultVo<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
