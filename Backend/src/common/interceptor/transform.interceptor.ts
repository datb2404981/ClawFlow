import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse } from 'express';
import { RESPONSE_MESSAGE } from '../decorator/decorators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const res = context.switchToHttp().getResponse<ExpressResponse>();
        return {
          // Lúc `map` chạy, response thường đã có status (mặc định 200; @HttpCode() vẫn nên dùng trên route)
          statusCode: res.statusCode,
          message:
            this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE, [
              context.getHandler(),
              context.getClass(),
            ]) ?? '',
          data,
        };
      }),
    );
  }
}