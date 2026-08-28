import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { ConfigConstains } from '../../configs/env.config';

interface AccessTokenPayload {
  id?: unknown;
  type?: unknown;
}

@Injectable()
export class TokenAuth implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    try {
      const token = this.extractAccessToken(req);

      if (!token) {
        throw new UnauthorizedException({
          message: 'Пользователь не авторизован'
        });
      }

      const user = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          issuer: this.configService.get<string>(ConfigConstains.jwtIssuer),
          audience: this.configService.get<string>(ConfigConstains.jwtAudience)
        }
      );

      if (
        user?.type !== 'access' ||
        typeof user.id !== 'string' ||
        !isUUID(user.id)
      ) {
        throw new UnauthorizedException({
          message: 'Токен не является валидным access token'
        });
      }

      req.user = user;

      return true;
    } catch {
      throw new UnauthorizedException({
        message: 'Пользователь не авторизован, токен не валиден'
      });
    }
  }

  private extractAccessToken(request: {
    headers?: { authorization?: unknown };
    cookies?: { access_token?: unknown };
  }): string | undefined {
    const authorization = request.headers?.authorization;

    if (typeof authorization === 'string') {
      const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

      if (match) {
        return match[1];
      }
    }

    const cookieToken = request.cookies?.access_token;

    return typeof cookieToken === 'string' && cookieToken.trim()
      ? cookieToken.trim()
      : undefined;
  }
}
