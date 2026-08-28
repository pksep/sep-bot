import loggerConfig from './logger.config';
import {
  REDACTED_BOT_TOKEN,
  redactBotTokenInUrl,
  redactError,
  redactLogValue
} from './redact-bot-token';

describe('bot token log redaction', () => {
  const rawToken = '42:fake-secret';
  const rawUrl = `/api/bot${rawToken}/getMe?verbose=true`;
  const safeUrl = `/api/bot${REDACTED_BOT_TOKEN}/getMe?verbose=true`;

  it('redacts tokens in relative and absolute URLs', () => {
    expect(redactBotTokenInUrl(rawUrl)).toBe(safeUrl);
    expect(
      redactBotTokenInUrl(`request failed: https://bot.test${rawUrl}`)
    ).toBe(`request failed: https://bot.test${safeUrl}`);
  });

  it('redacts URL-encoded token separators', () => {
    expect(redactBotTokenInUrl('/api/bot42%3Afake-secret/getMe')).toBe(
      `/api/bot${REDACTED_BOT_TOKEN}/getMe`
    );
  });

  it('does not redact the regular bots management route', () => {
    expect(redactBotTokenInUrl('/api/bots/42')).toBe('/api/bots/42');
  });

  it('redacts nested structured values without mutating the input', () => {
    const input = {
      request: { url: rawUrl },
      attempts: [`POST ${rawUrl}`]
    };

    const result = redactLogValue(input);

    expect(result).toEqual({
      request: { url: safeUrl },
      attempts: [`POST ${safeUrl}`]
    });
    expect(input.request.url).toBe(rawUrl);
  });

  it('redacts error messages and stacks', () => {
    const error = new Error(`Request failed: ${rawUrl}`);
    error.stack = `Error: Request failed: ${rawUrl}`;

    const result = redactError(error);

    expect(result.message).toBe(`Request failed: ${safeUrl}`);
    expect(result.stack).toBe(`Error: Request failed: ${safeUrl}`);
    expect(error.message).toContain(rawToken);
  });

  it('redacts automatic Pino request and error serializers', () => {
    const pinoHttp = loggerConfig.pinoHttp as any;
    const requestLog = pinoHttp.serializers.req({
      id: 'req-1',
      method: 'GET',
      url: rawUrl
    });
    const errorLog = pinoHttp.serializers.err(
      new Error(`Request failed: ${rawUrl}`)
    );

    expect(requestLog.url).toBe(safeUrl);
    expect(errorLog.message).toBe(`Request failed: ${safeUrl}`);
    expect(JSON.stringify({ requestLog, errorLog })).not.toContain(rawToken);
  });
});
