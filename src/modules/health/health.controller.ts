import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DbHealthIndicator } from './indicators/db.health';
import { RabbitHealthIndicator } from './indicators/rabbit.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DbHealthIndicator,
    private readonly rabbit: RabbitHealthIndicator,
    private readonly redis: RedisHealthIndicator
  ) {}

  /**
   * Liveness: is the process up and serving HTTP at all? Deliberately does NOT
   * touch any side-service — a slow Postgres or a flapping RabbitMQ must not get
   * the container restarted by an orchestrator. Always 200 while the event loop runs.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness — the process is up and serving HTTP' })
  live() {
    return {
      status: 'ok',
      service: 'sep-bot',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Readiness: can the gateway actually do its job right now? Checks every side
   * service it depends on — Postgres, RabbitMQ (the chat_server transport) and
   * Redis (cache + webhook queue). Returns 503 with per-check details if any is down.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness — Postgres, RabbitMQ and Redis are reachable' })
  ready() {
    return this.health.check([
      () => this.db.ping(),
      () => this.rabbit.ping(),
      () => this.redis.ping()
    ]);
  }
}
