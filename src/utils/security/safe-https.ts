import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

export interface LookupAddress {
  address: string;
  family: number;
}

export type ResolveAll = (hostname: string) => Promise<LookupAddress[]>;

export interface PublicHttpsTarget {
  address: string;
  family: number;
  url: URL;
}

export interface PublicHttpsRequestOptions {
  body?: Buffer;
  headers?: Record<string, string>;
  maxResponseBytes: number;
  method?: 'GET' | 'POST';
  timeoutMs: number;
}

export interface PublicHttpsResponse {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}

const ipv4ToNumber = (address: string): number | null => {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }
  return octets.reduce((value, octet) => value * 256 + octet, 0);
};

const isInIpv4Cidr = (
  address: number,
  base: string,
  prefixLength: number
): boolean => {
  const baseNumber = ipv4ToNumber(base);
  if (baseNumber === null) return false;
  const blockSize = 2 ** (32 - prefixLength);
  return Math.floor(address / blockSize) === Math.floor(baseNumber / blockSize);
};

const blockedIpv4Cidrs: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
];

const ipv6ToBigInt = (address: string): bigint | null => {
  const normalized = address.toLowerCase().split('%')[0];
  const halves = normalized.split('::');
  if (halves.length > 2) return null;

  const expand = (parts: string[]): string[] =>
    parts.flatMap(part => {
      if (!part.includes('.')) return [part];
      const ipv4 = ipv4ToNumber(part);
      if (ipv4 === null) return ['invalid'];
      return [
        ((ipv4 >>> 16) & 0xffff).toString(16),
        (ipv4 & 0xffff).toString(16)
      ];
    });

  const left = expand(halves[0] ? halves[0].split(':') : []);
  const right = expand(halves[1] ? halves[1].split(':') : []);
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;

  const groups = [
    ...left,
    ...Array(halves.length === 2 ? missing : 0).fill('0'),
    ...right
  ];
  if (groups.length !== 8) return null;

  try {
    return groups.reduce((value, group) => {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) throw new Error('invalid IPv6');
      return (value << BigInt(16)) + BigInt(`0x${group}`);
    }, BigInt(0));
  } catch {
    return null;
  }
};

const isInIpv6Cidr = (
  address: bigint,
  base: string,
  prefixLength: number
): boolean => {
  const baseNumber = ipv6ToBigInt(base);
  if (baseNumber === null) return false;
  const shift = BigInt(128 - prefixLength);
  return address >> shift === baseNumber >> shift;
};

const blockedIpv6Cidrs: Array<[string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8]
];

export const isBlockedNetworkAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address);
    return (
      value === null ||
      blockedIpv4Cidrs.some(([base, prefix]) =>
        isInIpv4Cidr(value, base, prefix)
      )
    );
  }

  if (family === 6) {
    const value = ipv6ToBigInt(address);
    if (value === null) return true;
    const mappedIpv4Prefix = ipv6ToBigInt('::ffff:0:0');
    if (
      mappedIpv4Prefix !== null &&
      value >> BigInt(32) === mappedIpv4Prefix >> BigInt(32)
    ) {
      const mapped = Number(value & BigInt('0xffffffff'));
      return blockedIpv4Cidrs.some(([base, prefix]) =>
        isInIpv4Cidr(mapped, base, prefix)
      );
    }
    return blockedIpv6Cidrs.some(([base, prefix]) =>
      isInIpv6Cidr(value, base, prefix)
    );
  }

  return true;
};

const defaultResolveAll: ResolveAll = hostname =>
  dnsLookup(hostname, { all: true, verbatim: true });

export const resolvePublicHttpsUrl = async (
  value: string,
  resolveAll: ResolveAll = defaultResolveAll
): Promise<PublicHttpsTarget> => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('URL is invalid');
  }

  if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed');
  if (url.username || url.password) {
    throw new Error('Credentials in URLs are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const directFamily = isIP(hostname);
  const addresses = directFamily
    ? [{ address: hostname, family: directFamily }]
    : await resolveAll(hostname);

  if (!addresses.length) throw new Error('URL hostname did not resolve');
  if (
    addresses.some(
      ({ address, family }) =>
        !isIP(address) ||
        ![4, 6].includes(family) ||
        isBlockedNetworkAddress(address)
    )
  ) {
    throw new Error('URL resolves to a blocked network address');
  }

  return { ...addresses[0], url };
};

export const requestPublicHttps = async (
  value: string,
  options: PublicHttpsRequestOptions
): Promise<PublicHttpsResponse> => {
  const target = await resolvePublicHttpsUrl(value);
  const { url } = target;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishWithError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const request = httpsRequest(
      {
        headers: { ...options.headers, Host: url.host },
        hostname: target.address,
        method: options.method ?? 'GET',
        path: `${url.pathname}${url.search}`,
        port: url.port ? Number(url.port) : 443,
        rejectUnauthorized: true,
        servername: isIP(url.hostname.replace(/^\[|\]$/g, ''))
          ? undefined
          : url.hostname
      },
      response => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode >= 300 && statusCode < 400) {
          response.resume();
          finishWithError(new Error('HTTPS redirects are not allowed'));
          return;
        }

        const declaredLength = Number(response.headers['content-length']);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > options.maxResponseBytes
        ) {
          response.destroy();
          finishWithError(new Error('HTTPS response is too large'));
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        response.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buffer.length;
          if (receivedBytes > options.maxResponseBytes) {
            response.destroy();
            finishWithError(new Error('HTTPS response is too large'));
            return;
          }
          chunks.push(buffer);
        });
        response.on('error', error => finishWithError(error));
        response.on('end', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            statusCode
          });
        });
      }
    );

    const timeout = setTimeout(() => {
      request.destroy(new Error('HTTPS request timed out'));
    }, options.timeoutMs);
    request.on('error', error => finishWithError(error));
    if (options.body) request.write(options.body);
    request.end();
  });
};
