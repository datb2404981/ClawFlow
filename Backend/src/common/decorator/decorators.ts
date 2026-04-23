import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

type RequestWithUser = { user?: Record<string, unknown> };

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (data === undefined) {
      return user;
    }
    // @User('email') → lấy field cấp 1; không hỗ trợ 'a.b' lồng
    if (!user) {
      return undefined;
    }
    return user[data];
  },
);

export const RESPONSE_MESSAGE = 'response_message';
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE, message);

export const IS_PUBLIC_KEY = 'isPublic';
export const SkipPermission = () => SetMetadata(IS_PUBLIC_KEY, true);