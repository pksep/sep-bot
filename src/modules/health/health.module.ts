import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { DbHealthIndicator } from './indicators/db.health';
import { RabbitHealthIndicator } from './indicators/rabbit.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  // re-declaring the existing queue here only gives us a producer handle to PING
  // its Redis connection — the worker stays in WebhooksModule.
  imports: [TerminusModule, BullModule.registerQueue({ name: 'webhook-delivery' })],
  controllers: [HealthController],
  providers: [DbHealthIndicator, RabbitHealthIndicator, RedisHealthIndicator]
})
export class HealthModule {}
