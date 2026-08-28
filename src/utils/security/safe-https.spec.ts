import { EventEmitter } from 'node:events';
import { request as httpsRequest } from 'node:https';
import {
  isBlockedNetworkAddress,
  requestPublicHttps,
  resolvePublicHttpsUrl
} from './safe-https';

jest.mock('node:https', () => ({ request: jest.fn() }));

const mockHttpsRequest = httpsRequest as unknown as jest.Mock;

describe('safe HTTPS URL validation', () => {
  beforeEach(() => {
    mockHttpsRequest.mockReset();
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '::1',
    'fc00::1',
    'fe80::1',
    'fec0::1',
    '::ffff:127.0.0.1'
  ])('blocks non-public address %s', address => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '93.184.216.34', '2001:4860:4860::8888'])(
    'accepts public address %s',
    address => {
      expect(isBlockedNetworkAddress(address)).toBe(false);
    }
  );

  it('requires HTTPS and rejects credentials', async () => {
    await expect(resolvePublicHttpsUrl('http://example.com')).rejects.toThrow(
      'Only HTTPS'
    );
    await expect(
      resolvePublicHttpsUrl('https://user:pass@example.com')
    ).rejects.toThrow('Credentials');
  });

  it('rejects a hostname if any resolved address is private', async () => {
    await expect(
      resolvePublicHttpsUrl('https://mixed.example/webhook', async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 }
      ])
    ).rejects.toThrow('blocked network address');
  });

  it('pins a validated public DNS result', async () => {
    await expect(
      resolvePublicHttpsUrl('https://public.example/webhook', async () => [
        { address: '93.184.216.34', family: 4 }
      ])
    ).resolves.toMatchObject({
      address: '93.184.216.34',
      family: 4
    });
  });

  it('rejects redirects instead of following them', async () => {
    const request = Object.assign(new EventEmitter(), {
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn()
    });
    const response = Object.assign(new EventEmitter(), {
      destroy: jest.fn(),
      headers: { location: 'https://other.example/avatar.png' },
      resume: jest.fn(),
      statusCode: 302
    });
    mockHttpsRequest.mockImplementation(
      (_options: unknown, callback: (value: typeof response) => void) => {
        setImmediate(() => callback(response));
        return request;
      }
    );

    await expect(
      requestPublicHttps('https://93.184.216.34/avatar.png', {
        maxResponseBytes: 1024,
        timeoutMs: 100
      })
    ).rejects.toThrow('redirects are not allowed');
    expect(response.resume).toHaveBeenCalled();
  });

  it('enforces the declared response size limit', async () => {
    const request = Object.assign(new EventEmitter(), {
      destroy: jest.fn(),
      end: jest.fn(),
      write: jest.fn()
    });
    const response = Object.assign(new EventEmitter(), {
      destroy: jest.fn(),
      headers: { 'content-length': '5' },
      resume: jest.fn(),
      statusCode: 200
    });
    mockHttpsRequest.mockImplementation(
      (_options: unknown, callback: (value: typeof response) => void) => {
        setImmediate(() => callback(response));
        return request;
      }
    );

    await expect(
      requestPublicHttps('https://93.184.216.34/avatar.png', {
        maxResponseBytes: 4,
        timeoutMs: 100
      })
    ).rejects.toThrow('response is too large');
    expect(response.destroy).toHaveBeenCalled();
  });

  it('enforces an overall request timeout', async () => {
    const request = Object.assign(new EventEmitter(), {
      destroy: jest.fn((error?: Error) => {
        if (error) request.emit('error', error);
      }),
      end: jest.fn(),
      write: jest.fn()
    });
    mockHttpsRequest.mockReturnValue(request);

    await expect(
      requestPublicHttps('https://93.184.216.34/avatar.png', {
        maxResponseBytes: 1024,
        timeoutMs: 5
      })
    ).rejects.toThrow('request timed out');
  });
});
