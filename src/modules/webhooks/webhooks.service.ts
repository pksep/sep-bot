import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BotsService } from '../bots/bots.service';
import { LoggerService } from '../logger/logger.service';
import { WebhookJobData } from './webhooks.processor';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectQueue('webhook-delivery') private webhookQueue: Queue,
    private botsService: BotsService,
    private logger: LoggerService
  ) {}

  async enqueueDelivery(
    botId: number,
    updateId: number,
    payload: object
  ): Promise<void> {
    try {
      const bot = await this.botsService.findById(botId);
      const webhookConfig = bot?.webhookConfig as any;

      if (!webhookConfig?.url) {
        return; // Нет webhook — пропускаем
      }

      const jobData: WebhookJobData = {
        botId,
        updateId,
        webhookUrl: webhookConfig.url,
        webhookSecret: webhookConfig.secret,
        payload,
        attempt: 1
      };

      await this.webhookQueue.add('deliver', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 1000
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        'WebhooksService'
      );
    }
  }
}
