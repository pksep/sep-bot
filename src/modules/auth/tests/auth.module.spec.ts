import { ConfigService } from '@nestjs/config';
import { ConfigConstains } from '../../../configs/env.config';
import { createJwtOptions } from '../auth.module';

describe('AuthModule JWT configuration', () => {
  it('не запускается без JWT_SECRET', () => {
    const configService = {
      get: jest.fn()
    } as unknown as ConfigService;

    expect(() => createJwtOptions(configService)).toThrow(
      'JWT_SECRET is not defined in environment variables'
    );
  });

  it('настраивает подпись с issuer и audience', () => {
    const values = new Map<string, string>([
      [ConfigConstains.jwtSecret, 'shared-secret'],
      [ConfigConstains.jwtIssuer, 'chat-server'],
      [ConfigConstains.jwtAudience, 'sep-bot']
    ]);
    const configService = {
      get: jest.fn((key: string) => values.get(key))
    } as unknown as ConfigService;

    expect(createJwtOptions(configService)).toEqual({
      secret: 'shared-secret',
      signOptions: {
        expiresIn: '24h',
        issuer: 'chat-server',
        audience: 'sep-bot'
      }
    });
  });
});
