export const REDACTED_BOT_TOKEN = '[REDACTED]';

const BOT_TOKEN_IN_URL =
  /(\/bot)([^/?#\s]+?(?::|%3A)[^/?#\s]+)(?=\/|[?#\s]|$)/gi;

/**
 * Redacts Telegram-style bot tokens embedded in request URLs without changing
 * the rest of the path, query string or log message.
 */
export function redactBotTokenInUrl(value: string): string {
  return value.replace(BOT_TOKEN_IN_URL, `$1${REDACTED_BOT_TOKEN}`);
}

export function redactError(error: Error): Error {
  const safeError = new Error(redactBotTokenInUrl(error.message));
  safeError.name = error.name;

  if (error.stack) {
    safeError.stack = redactBotTokenInUrl(error.stack);
  }

  Object.assign(safeError, redactLogValue({ ...error }));
  return safeError;
}

/**
 * Creates a redacted copy suitable for structured application logs. Inputs are
 * never mutated, so the original request/error can still be handled normally.
 */
export function redactLogValue<T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T {
  if (typeof value === 'string') {
    return redactBotTokenInUrl(value) as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return redactError(value) as T;
  }

  if (value instanceof URL) {
    return redactBotTokenInUrl(value.toString()) as T;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  const previous = seen.get(value);
  if (previous) {
    return '[Circular]' as T;
  }

  const copy: unknown[] | Record<string, unknown> = Array.isArray(value)
    ? []
    : {};
  seen.set(value, copy);

  for (const [key, child] of Object.entries(value)) {
    copy[key] = redactLogValue(child, seen);
  }

  return copy as T;
}
