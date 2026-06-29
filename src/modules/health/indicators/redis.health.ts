import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult
} from '@nestjs/terminus';
import { withTimeout } from './with-timeout';

/**
 * Readiness probe for Redis — backs both the cache and the BullMQ webhook
 * delivery queue. We PING through the queue's own connection, so this checks
 * the exact client the gateway relies on for outbound webhook delivery.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@InjectQueue('webhook-delivery') private readonly queue: Queue) {
    super();
  }

  async ping(key = 'redis'): Promise<HealthIndicatorResult> {
    try {
      const pong = await withTimeout(
        this.queue.client.then(client => client.ping()),
        3000,
        'redis'
      );
      if (pong !== 'PONG') throw new Error(`unexpected PING reply: ${pong}`);
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Redis is unavailable',
        this.getStatus(key, false, {
          message: err instanceof Error ? err.message : String(err)
        })
      );
    }
  }
}
