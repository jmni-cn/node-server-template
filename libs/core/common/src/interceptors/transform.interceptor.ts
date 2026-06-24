import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';
import type { BaseResponse } from '../vo/base-response.vo';

/**
 * 统一响应转换拦截器
 * 将所有成功响应包装为统一格式
 *
 * 响应格式：
 * ```json
 * {
 *   "success": true,
 *   "code": "OK",
 *   "message": "操作成功",
 *   "data": {...},
 *   "timestamp": 1702300000000,
 *   "path": "/api/users",
 *   "requestId": "uuid-string"
 * }
 * ```
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  BaseResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponse<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const path = request.url;
    const requestId = (request.headers['x-request-id'] as string) || undefined;

    return next.handle().pipe(
      map((data) => {
        // 如果已经是标准响应格式，直接返回
        // 需要同时检查 success、code、timestamp 字段，避免误判业务数据中的 success 字段
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'code' in data &&
          'timestamp' in data
        ) {
          return data;
        }

        // 包装为统一响应格式
        return {
          success: true,
          code: 'OK',
          message: '操作成功',
          data,
          timestamp: Date.now(),
          path,
          requestId,
        };
      }),
    );
  }
}
