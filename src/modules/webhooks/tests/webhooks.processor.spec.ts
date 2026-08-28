import { Job } from 'bullmq';
import { LoggerService } from '../../logger/logger.service';
import { requestPublicHttps } from '../../../utils/security/safe-https';
import { WebhookJobData, WebhookProcessor } from '../webhooks.processor';

jest.mock('../../../utils/security/safe-https', () => ({
  requestPublicHttps: jest.fn()
}));

const mockRequestPublicHttps = requestPublicHttps as jest.MockedFunction<
  typeof requestPublicHttps
>;

const createJob = (payload: object): Job<WebhookJobData> =>
  ({
    data: {
      attempt: 1,
      botId: 7,
      payload,
      updateId: 42,
      webhookSecret: 'secret',
      webhookUrl: 'https://bot.example/webhook'
    }
  }) as Job<WebhookJobData>;

describe('WebhookProcessor', () => {
  const logger = {
    error: jest.fn(),
    log: jest.fn()
  } as unknown as LoggerService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revalidates and pins the webhook destination for every delivery', async () => {
    mockRequestPublicHttps.mockResolvedValue({
      body: Buffer.alloc(0),
      headers: {},
      statusCode: 204
    });
    const processor = new WebhookProcessor(logger);

    await processor.process(createJob({ update_id: 42 }));

    expect(mockRequestPublicHttps).toHaveBeenCalledWith(
      'https://bot.example/webhook',
      expect.objectContaining({
        maxResponseBytes: 64 * 1024,
        method: 'POST',
        timeoutMs: 10_000
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Webhook delivered: bot=7 update=42 status=204',
      'WebhookProcessor'
    );
  });

  it('rejects redirect and error responses', async () => {
    mockRequestPublicHttps.mockResolvedValue({
      body: Buffer.alloc(0),
      headers: { location: 'https://other.example/webhook' },
      statusCode: 302
    });
    const processor = new WebhookProcessor(logger);

    await expect(
      processor.process(createJob({ update_id: 42 }))
    ).rejects.toThrow('Webhook returned HTTP 302');
  });

  it('rejects oversized webhook payloads before making a request', async () => {
    const processor = new WebhookProcessor(logger);

    await expect(
      processor.process(createJob({ data: 'x'.repeat(1024 * 1024) }))
    ).rejects.toThrow('Webhook payload is too large');
    expect(mockRequestPublicHttps).not.toHaveBeenCalled();
  });
});
