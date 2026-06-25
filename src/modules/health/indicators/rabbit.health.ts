import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult
} from '@nestjs/terminus';

/**
 * Readiness probe for RabbitMQ — the ONLY transport between the gateway and
 * chat_server (chat.events / bot.commands). If the bus is down the gateway can
 * accept Bot-API calls but can neither receive chat events nor deliver RPC, so
 * it must report not-ready.
 */
@Injectable()
export class RabbitHealthIndicator extends HealthIndicator {
  constructor(private readonly amqp: AmqpConnection) {
    super();
  }

  async ping(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    const connected = this.amqp?.connected === true;
    const result = this.getStatus(key, connected, { connected });
    if (connected) return result;
    throw new HealthCheckError('RabbitMQ is not connected', result);
  }
}
