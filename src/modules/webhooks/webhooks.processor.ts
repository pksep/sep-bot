import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LoggerService } from '../logger/logger.service';

export interface WebhookJobData {
  botId: number;
  updateId: number;
  webhookUrl: string;
  webhookSecret?: string;
  payload: object;
  attempt: number;
}

@Processor('webhook-delivery')
@Injectable()
export class WebhookProcessor extends WorkerHost {
  constructor(private logger: LoggerService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { webhookUrl, webhookSecret, payload, botId, updateId, attempt } = job.data;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (webhookSecret) {
        headers['X-Telegram-Bot-Api-Secret-Token'] = webhookSecret;
      }

      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 10000
      });

      this.logger.log(
        `Webhook delivered: bot=${botId} update=${updateId} status=${response.status}`,
        'WebhookProcessor'
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        `WebhookProcessor: bot=${botId} update=${updateId} attempt=${attempt}`
      );

      // Retry будет обрабатываться BullMQ
      throw error;
    }
  }
}
