import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BotApiService } from '../bot-api.service';
import { SetWebhookDto } from '../../bots/dto/bots.dto';
import { Bot } from '../../bots/model/bots.model';
import { ChatBridgeService } from '../../chat-bridge/chat-bridge.service';
import { UpdatesService } from '../../updates/updates.service';
import { BotsService } from '../../bots/bots.service';
import { resolvePublicHttpsUrl } from '../../../utils/security/safe-https';

jest.mock('../../../utils/security/safe-https', () => ({
  resolvePublicHttpsUrl: jest.fn()
}));

const mockResolvePublicHttpsUrl = resolvePublicHttpsUrl as jest.MockedFunction<
  typeof resolvePublicHttpsUrl
>;

describe('Bot API webhook validation', () => {
  it('rejects non-HTTPS webhook DTOs at runtime', async () => {
    const dto = plainToInstance(SetWebhookDto, {
      url: 'http://127.0.0.1/webhook'
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('validates webhook secret and allowed updates at runtime', async () => {
    const emptySecret = plainToInstance(SetWebhookDto, {
      url: 'https://bot.example/webhook',
      secret: ''
    });
    const invalidUpdates = plainToInstance(SetWebhookDto, {
      url: 'https://bot.example/webhook',
      allowed_updates: 'message'
    });

    expect(await validate(emptySecret)).not.toHaveLength(0);
    expect(await validate(invalidUpdates)).not.toHaveLength(0);
  });

  it('resolves a public HTTPS target before storing the webhook', async () => {
    const setWebhook = jest.fn();
    const service = new BotApiService(
      {} as ChatBridgeService,
      {} as UpdatesService,
      { setWebhook } as unknown as BotsService
    );
    mockResolvePublicHttpsUrl.mockResolvedValue({
      address: '93.184.216.34',
      family: 4,
      url: new URL('https://bot.example/webhook')
    });

    await expect(
      service.setWebhook({ id: 7 } as Bot, {
        url: 'https://bot.example/webhook',
        secret: 'secret',
        allowed_updates: ['message']
      })
    ).resolves.toEqual({ ok: true, result: true });

    expect(mockResolvePublicHttpsUrl).toHaveBeenCalledWith(
      'https://bot.example/webhook'
    );
    expect(setWebhook).toHaveBeenCalledWith(7, {
      url: 'https://bot.example/webhook',
      secret: 'secret',
      allowedUpdates: ['message']
    });
  });

  it('does not store a webhook whose DNS validation fails', async () => {
    const setWebhook = jest.fn();
    const service = new BotApiService(
      {} as ChatBridgeService,
      {} as UpdatesService,
      { setWebhook } as unknown as BotsService
    );
    mockResolvePublicHttpsUrl.mockRejectedValue(
      new Error('URL resolves to a blocked network address')
    );

    await expect(
      service.setWebhook({ id: 7 } as Bot, {
        url: 'https://private.example/webhook'
      })
    ).resolves.toMatchObject({ ok: false, error_code: 400 });
    expect(setWebhook).not.toHaveBeenCalled();
  });
});
