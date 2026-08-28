import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigConstains } from '../../configs/env.config';
import { TokenAuth } from './jwt-auth.guard';

export const createJwtOptions = (
  configService: ConfigService
): JwtModuleOptions => {
  const secret = configService.get<string>(ConfigConstains.jwtSecret);

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return {
    secret,
    signOptions: {
      expiresIn: '24h',
      issuer: configService.get<string>(ConfigConstains.jwtIssuer),
      audience: configService.get<string>(ConfigConstains.jwtAudience)
    }
  };
};

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenAuth],
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtOptions
    }),
    ConfigModule
  ],
  exports: [AuthService, JwtModule, TokenAuth]
})
export class AuthModule {}
