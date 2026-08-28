import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { ConfigConstains } from '../../../configs/env.config';
import { TokenAuth } from '../../auth/jwt-auth.guard';
import { BotsController } from '../bots.controller';
import { BotsService } from '../bots.service';

const SECRET = 'chat-252-controller-secret';
const ISSUER = 'chat-server';
const AUDIENCE = 'sep-bot';
const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const FOREIGN_OWNER_ID = '20000000-0000-4000-8000-000000000002';

describe('BotsController authorization', () => {
  const botsService = {
    findByOwner: jest.fn().mockResolvedValue([])
  };
  const jwtService = new JwtService({ secret: SECRET });
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BotsController],
      providers: [
        TokenAuth,
        { provide: BotsService, useValue: botsService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === ConfigConstains.jwtIssuer) return ISSUER;
              if (key === ConfigConstains.jwtAudience) return AUDIENCE;
              return undefined;
            }
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    botsService.findByOwner.mockResolvedValue([]);
  });

  it('игнорирует чужой X-Owner-Id и использует владельца из access token', async () => {
    const token = jwtService.sign(
      { id: OWNER_ID, type: 'access' },
      { issuer: ISSUER, audience: AUDIENCE }
    );

    await request(app.getHttpServer())
      .get('/bots')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Owner-Id', FOREIGN_OWNER_ID)
      .expect(200);

    expect(botsService.findByOwner).toHaveBeenCalledWith(OWNER_ID);
    expect(botsService.findByOwner).not.toHaveBeenCalledWith(FOREIGN_OWNER_ID);
  });

  it('не принимает X-Owner-Id без access token', async () => {
    await request(app.getHttpServer())
      .get('/bots')
      .set('X-Owner-Id', OWNER_ID)
      .expect(401);

    expect(botsService.findByOwner).not.toHaveBeenCalled();
  });
});
