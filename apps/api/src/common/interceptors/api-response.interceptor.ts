import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

const whiteList = ['/models-streaming'];

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = _context.switchToHttp().getRequest<Request>();
    if (whiteList.includes(request.url)) {
      return next.handle() as Observable<ApiResponse<T>>;
    } else {
      return next.handle().pipe(
        map((data) => ({
          code: 0,
          data,
          msg: 'success',
        })),
      );
    }
  }
}
