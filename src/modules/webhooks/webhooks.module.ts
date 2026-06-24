import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor } from './webhooks.processor';
import { WebhooksService } from './webhooks.service';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'webhook-delivery' }), BotsModule],
  providers: [WebhookProcessor, WebhooksService],
  exports: [WebhooksService]
})
export class WebhooksModule {}
