import {
  HttpException,
  Injectable,
  HttpStatus,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserDataToken } from './interfaces/interface';
import { Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private logger: LoggerService,
    private jwtService: JwtService
  ) {}

  async generateToken(payload: IUserDataToken): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async checkToken(
    token: string
  ): Promise<{ ok: boolean; user: IUserDataToken }> {
    try {
      const decoded = this.jwtService.verify(token);
      if (!decoded) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return {
        ok: true,
        user: decoded
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  setTokenCookie(response: Response, token: string): void {
    response.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
      path: '/'
    });
  }
}
