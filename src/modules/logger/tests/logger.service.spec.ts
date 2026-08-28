import { PinoLogger } from 'nestjs-pino';
import { LoggerService } from '../logger.service';
import { REDACTED_BOT_TOKEN } from 'src/utils/logger/redact-bot-token';

describe('LoggerService redaction', () => {
  const rawToken = '42:fake-secret';
  const rawUrl = `/api/bot${rawToken}/getMe`;
  const safeUrl = `/api/bot${REDACTED_BOT_TOKEN}/getMe`;
  let pino: jest.Mocked<PinoLogger>;
  let logger: LoggerService;

  beforeEach(() => {
    pino = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn()
    } as unknown as jest.Mocked<PinoLogger>;
    logger = new LoggerService(pino);
  });

  it('redacts string messages and contexts', () => {
    logger.log(`GET ${rawUrl}`, `HTTP GET ${rawUrl}`);

    expect(pino.info).toHaveBeenCalledWith(
      { context: `HTTP GET ${safeUrl}` },
      `GET ${safeUrl}`
    );
  });

  it('redacts nested objects before serializing them', () => {
    logger.warn({ request: { url: rawUrl } }, 'Proxy');

    expect(pino.warn).toHaveBeenCalledWith(
      { context: 'Proxy' },
      JSON.stringify({ request: { url: safeUrl } })
    );
  });

  it('redacts Error objects before logging them', () => {
    const error = new Error(`Request failed: ${rawUrl}`);

    logger.error(error, `HTTP GET ${rawUrl}`);

    const [bindings, message] = pino.error.mock.calls[0];
    expect(message).toBe(`Request failed: ${safeUrl}`);
    expect(bindings.context).toBe(`HTTP GET ${safeUrl}`);
    expect(bindings.err).toBeInstanceOf(Error);
    expect(bindings.err.message).toBe(`Request failed: ${safeUrl}`);
    expect(JSON.stringify(bindings)).not.toContain(rawToken);
  });

  it('redacts non-Error structured failures', () => {
    logger.error({ requestUrl: rawUrl }, 'APM');

    expect(pino.error).toHaveBeenCalledWith(
      { error: { requestUrl: safeUrl }, context: 'APM' },
      JSON.stringify({ requestUrl: safeUrl })
    );
  });
});
