import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  redactBotTokenInUrl,
  redactError,
  redactLogValue
} from 'src/utils/logger/redact-bot-token';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: string | object, context?: string) {
    this.logger.info(
      { context: this.safeContext(context) },
      this.safeMessage(message)
    );
  }

  error(error: unknown, context?: string) {
    if (error instanceof Error) {
      const safeError = redactError(error);
      this.logger.error(
        { err: safeError, context: this.safeContext(context) },
        safeError.message
      );
    } else {
      const safeError = redactLogValue(error);
      this.logger.error(
        { error: safeError, context: this.safeContext(context) },
        typeof safeError === 'string' ? safeError : JSON.stringify(safeError)
      );
    }
  }

  warn(message: string | object, context?: string) {
    this.logger.warn(
      { context: this.safeContext(context) },
      this.safeMessage(message)
    );
  }

  debug(message: string | object, context?: string) {
    this.logger.debug(
      { context: this.safeContext(context) },
      this.safeMessage(message)
    );
  }

  // Подробные (trace) логи
  verbose(message: string | object, context?: string) {
    this.logger.trace(
      { context: this.safeContext(context) },
      this.safeMessage(message)
    );
  }

  private safeContext(context?: string): string | undefined {
    return context ? redactBotTokenInUrl(context) : context;
  }

  private safeMessage(message: string | object): string {
    const safeMessage = redactLogValue(message);
    return typeof safeMessage === 'string'
      ? safeMessage
      : JSON.stringify(safeMessage);
  }
}
