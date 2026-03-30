import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenAuth implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // Пропускаем локальные запросы в dev-режиме
    if (
      process.env.NODE_ENV === 'development' &&
      ['localhost', '127.0.0.1'].includes(req.hostname)
    ) {
      return true;
    }

    // Пропускаем публичные маршруты
    if (this.isPublicPath(req.originalUrl)) return true;

    // SSE без аутентификации (нельзя задать заголовок)
    if (req.originalUrl.indexOf('sse-') !== -1) return true;

    try {
      const tokenCookie = req.cookies?.access_token;

      if (!tokenCookie) {
        throw new UnauthorizedException({
          message: 'Пользователь не авторизован'
        });
      }

      const user = this.jwtService.verify(tokenCookie);
      req.user = user;

      return !!user?.id;
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Пользователь не авторизован, токен не валиден'
      });
    }
  }

  private isPublicPath(url: string): boolean {
    const publicPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/check',
      '/api/docs'
    ];
    return publicPaths.some(path => url.startsWith(path));
  }
}
