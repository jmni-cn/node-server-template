import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PageMetaVo, PageResultVo } from '../vo/pagination.vo';
import { BaseResponseVo } from '../vo/base-response.vo';

/**
 * 分页响应装饰器
 * 用于 Swagger 文档生成，自动生成分页响应的 schema
 *
 * @example
 * ```typescript
 * @Get()
 * @ApiPaginatedResponse(UserVo, '获取用户列表成功')
 * async findAll(@Query() dto: PaginationDto) {
 *   return this.userService.findAll(dto);
 * }
 * ```
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = '分页查询成功',
) => {
  return applyDecorators(
    ApiExtraModels(BaseResponseVo, PageResultVo, PageMetaVo, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseVo) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: { $ref: getSchemaPath(PageMetaVo) },
                },
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * 单个对象响应装饰器
 * 用于 Swagger 文档生成，自动生成单个对象响应的 schema
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiBaseResponse(UserVo, '获取用户详情成功')
 * async findOne(@Param('id') id: string) {
 *   return this.userService.findOne(id);
 * }
 * ```
 */
export const ApiBaseResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = '操作成功',
) => {
  return applyDecorators(
    ApiExtraModels(BaseResponseVo, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseVo) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
};

/**
 * 数组响应装饰器
 * 用于 Swagger 文档生成，自动生成数组响应的 schema
 *
 * @example
 * ```typescript
 * @Get('all')
 * @ApiArrayResponse(UserVo, '获取所有用户成功')
 * async findAll() {
 *   return this.userService.findAll();
 * }
 * ```
 */
export const ApiArrayResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = '查询成功',
) => {
  return applyDecorators(
    ApiExtraModels(BaseResponseVo, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseVo) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * 成功响应装饰器（无数据）
 * 用于删除、更新等不返回数据的操作
 *
 * @example
 * ```typescript
 * @Delete(':id')
 * @ApiSuccessResponse('删除用户成功')
 * async remove(@Param('id') id: string) {
 *   return this.userService.remove(id);
 * }
 * ```
 */
export const ApiSuccessResponse = (description = '操作成功') => {
  return applyDecorators(
    ApiExtraModels(BaseResponseVo),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseVo) },
          {
            properties: {
              data: {
                type: 'null',
                nullable: true,
              },
            },
          },
        ],
      },
    }),
  );
};
