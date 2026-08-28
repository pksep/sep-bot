import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConfigConstains } from '../../../configs/env.config';
import { TokenAuth } from '../jwt-auth.guard';

const SECRET = 'chat-252-test-secret';
const ISSUER = 'chat-server';
const AUDIENCE = 'sep-bot';
const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const FOREIGN_OWNER_ID = '20000000-0000-4000-8000-000000000002';

const createContext = (request: object): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request })
  }) as ExecutionContext;

describe('TokenAuth', () => {
  const jwtService = new JwtService({ secret: SECRET });
  const configService = {
    get: jest.fn((key: string) => {
      if (key === ConfigConstains.jwtIssuer) return ISSUER;
      if (key === ConfigConstains.jwtAudience) return AUDIENCE;
      return undefined;
    })
  } as unknown as ConfigService;
  const guard = new TokenAuth(jwtService, configService);

  const sign = (overrides: Record<string, unknown> = {}, options = {}) =>
    jwtService.sign(
      {
        id: OWNER_ID,
        type: 'access',
        ...overrides
      },
      {
        issuer: ISSUER,
        audience: AUDIENCE,
        ...options
      }
    );

  it('принимает Bearer access token с ожидаемыми issuer и audience', async () => {
    const request = {
      headers: {
        authorization: `Bearer ${sign()}`,
        'x-owner-id': FOREIGN_OWNER_ID
      },
      cookies: {}
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toMatchObject({
      user: { id: OWNER_ID, type: 'access' }
    });
  });

  it.each([
    ['без JWT', undefined],
    ['с неверным issuer', sign({}, { issuer: 'foreign-service' })],
    ['с неверным audience', sign({}, { audience: 'foreign-api' })],
    ['с refresh token', sign({ type: 'refresh' })],
    ['с невалидным user id', sign({ id: 'not-a-uuid' })]
  ])('отклоняет запрос %s, даже если передан X-Owner-Id', async (_, token) => {
    const request = {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-owner-id': FOREIGN_OWNER_ID
      },
      cookies: {}
    };

    await expect(
      guard.canActivate(createContext(request))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request).not.toHaveProperty('user');
  });
});
