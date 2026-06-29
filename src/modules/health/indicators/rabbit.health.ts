import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult
} from '@nestjs/terminus';
import {
  BOT_COMMANDS_EXCHANGE,
  RK_BOT_HEALTH_CHECK
} from '../../chat-bridge/rabbitmq.constants';

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

    if (!connected) {
      const result = this.getStatus(key, false, {
        connected,
        chatServerReady: false
      });
      throw new HealthCheckError('RabbitMQ is not connected', result);
    }

    try {
      const response = await this.amqp.request<{ ok: boolean; result?: any }>({
        exchange: BOT_COMMANDS_EXCHANGE,
        routingKey: RK_BOT_HEALTH_CHECK,
        payload: { service: 'sep-bot', timestamp: new Date().toISOString() },
        timeout: 3000
      });

      const ready = response?.ok === true;
      const result = this.getStatus(key, ready, {
        connected,
        chatServerReady: ready
      });

      if (ready) return result;

      throw new HealthCheckError(
        'chat_server bot transport is not ready',
        result
      );
    } catch (err) {
      const result = this.getStatus(key, false, {
        connected,
        chatServerReady: false,
        message: err instanceof Error ? err.message : String(err)
      });

      throw new HealthCheckError(
        'chat_server bot transport is not ready',
        result
      );
    }
  }
}
