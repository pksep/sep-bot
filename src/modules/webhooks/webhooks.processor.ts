import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { requestPublicHttps } from '../../utils/security/safe-https';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_WEBHOOK_PAYLOAD_BYTES = 1024 * 1024;
const MAX_WEBHOOK_RESPONSE_BYTES = 64 * 1024;

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
  constructor(private readonly logger: LoggerService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { webhookUrl, webhookSecret, payload, botId, updateId, attempt } =
      job.data;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (webhookSecret) {
        headers['X-Telegram-Bot-Api-Secret-Token'] = webhookSecret;
      }

      const body = Buffer.from(JSON.stringify(payload));

      if (body.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
        throw new Error('Webhook payload is too large');
      }

      headers['Content-Length'] = String(body.length);
      const response = await requestPublicHttps(webhookUrl, {
        body,
        headers,
        maxResponseBytes: MAX_WEBHOOK_RESPONSE_BYTES,
        method: 'POST',
        timeoutMs: WEBHOOK_TIMEOUT_MS
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Webhook returned HTTP ${response.statusCode}`);
      }

      this.logger.log(
        `Webhook delivered: bot=${botId} update=${updateId} status=${response.statusCode}`,
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
