import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult
} from '@nestjs/terminus';
import { withTimeout } from './with-timeout';

/** Readiness probe for the bot gateway's own Postgres (`sep_bot`). */
@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize
  ) {
    super();
  }

  async ping(key = 'postgres'): Promise<HealthIndicatorResult> {
    try {
      await withTimeout(this.sequelize.query('SELECT 1'), 3000, 'postgres');
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Postgres is unavailable',
        this.getStatus(key, false, {
          message: err instanceof Error ? err.message : String(err)
        })
      );
    }
  }
}
